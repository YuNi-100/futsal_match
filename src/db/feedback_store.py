"""Analysis persistence in the existing video_analysis/video_event tables."""
from contextlib import contextmanager
import json
from datetime import datetime, timezone
from fastapi import HTTPException
from src.db import video_repository as repository
from src.db.database import is_postgres, assert_postgres_writes


@contextmanager
def analysis_connection():
    connection = repository.connect()
    locked = False
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT DATABASE() AS db_name')
            db_name=cursor.fetchone()['db_name']
            if is_postgres(connection):assert_postgres_writes(connection,'analysis')
            elif db_name != 'futsaldb_test':
                raise HTTPException(503, '현재 분석 저장은 테스트 DB에서만 사용할 수 있습니다.')
            cursor.execute('SELECT GET_LOCK(%s, 0) AS acquired', ('wgh_test_video_feedback',))
            locked = cursor.fetchone()['acquired'] == 1
            if not locked:
                raise HTTPException(409, '다른 분석이 진행 중입니다. 완료 후 다시 시도해 주세요.')
        yield connection
    except Exception:
        connection.rollback()
        raise
    finally:
        try:
            if locked:
                with connection.cursor() as cursor:
                    cursor.execute('SELECT RELEASE_LOCK(%s)', ('wgh_test_video_feedback',))
        finally:
            connection.close()


def decode(row):
    try:
        result = json.loads(row['feedback'] or '')
        if result.get('storage_version') != 1:
            return None
        result['analysis_id'] = row['analysis_id']
        return result
    except (ValueError, TypeError, AttributeError):
        return None


def find_saved(connection, video_id, request_key):
    with connection.cursor() as cursor:
        cursor.execute('SELECT analysis_id, feedback FROM video_analysis WHERE video_id=%s ORDER BY analysis_id DESC LIMIT 100', (video_id,))
        for row in cursor.fetchall():
            result = decode(row)
            if result and result.get('request_key') == request_key:
                return result
    return None


def save(connection, result):
    content = json.dumps(result, ensure_ascii=False)
    if len(content.encode('utf-8')) > 60000:
        raise HTTPException(502, '분석 결과가 저장 한도를 넘었습니다. 재실행 전 사용 내역을 확인해 주세요.')
    with connection.cursor() as cursor:
        cursor.execute('INSERT INTO video_analysis (video_id, summary, feedback, ai_model) VALUES (%s,%s,%s,%s)',
                       (result['video_id'], result['analysis']['summary'], content, result['model'][:100]))
        analysis_id = cursor.lastrowid
        for index, scene in enumerate(result['analysis']['scenes']):
            cursor.execute('''INSERT INTO video_event (analysis_id,event_type,start_seconds,end_seconds,description,sort_order)
                              VALUES (%s,%s,%s,NULL,%s,%s)''',
                           (analysis_id, scene['category'], scene['time_seconds'],
                            json.dumps(scene, ensure_ascii=False), index))
    connection.commit()
    return {**result, 'analysis_id': analysis_id}


def list_saved(connection, video_id=None):
    with connection.cursor() as cursor:
        sql = '''SELECT a.analysis_id,a.video_id,a.summary,a.ai_model,a.analyzed_at,a.feedback,v.title,v.youtube_id
                 FROM video_analysis a JOIN futsal_video v ON v.video_id=a.video_id
                 WHERE v.user_id=1'''
        params = ()
        if video_id is not None:
            sql += ' AND a.video_id=%s'
            params = (video_id,)
        cursor.execute(sql + ' ORDER BY a.analysis_id DESC LIMIT 100', params)
        rows = cursor.fetchall()
        for row in rows:
            result = decode(row)
            review = (result or {}).get('review', {})
            row['published'] = bool(review.get('publication'))
            row['review_revision'] = review.get('revision', 0)
            row.pop('feedback', None)
        return rows


def get_saved(connection, analysis_id):
    with connection.cursor() as cursor:
        cursor.execute('''SELECT a.analysis_id,a.feedback FROM video_analysis a
                          JOIN futsal_video v ON v.video_id=a.video_id
                          WHERE a.analysis_id=%s AND v.user_id=1''', (analysis_id,))
        row = cursor.fetchone()
    return decode(row) if row else None


def update_review(connection, analysis_id, payload, actor_id):
    with connection.cursor() as cursor:
        cursor.execute('SELECT DATABASE() AS db_name')
        db_name=cursor.fetchone()['db_name']
        if is_postgres(connection):assert_postgres_writes(connection,'analysis')
        elif db_name != 'futsaldb_test':
            raise HTTPException(503, '현재 검수 저장은 테스트 DB에서만 사용할 수 있습니다.')
        cursor.execute('''SELECT a.analysis_id,a.feedback FROM video_analysis a
                          JOIN futsal_video v ON v.video_id=a.video_id
                          WHERE a.analysis_id=%s AND v.user_id=1 FOR UPDATE''', (analysis_id,))
        row = cursor.fetchone()
        result = decode(row) if row else None
        if not result:
            raise HTTPException(404, '검수할 분석 결과를 찾을 수 없습니다.')
        review = result.get('review', {})
        if payload.revision != review.get('revision', 0):
            raise HTTPException(409, '다른 창에서 수정되었습니다. 새로고침 후 다시 확인해 주세요.')
        for scene in payload.scenes:
            if not result['start_seconds'] <= scene.time_seconds < result['end_seconds']:
                raise HTTPException(422, '장면 시간은 분석한 영상 구간 안에 있어야 합니다.')
        now = datetime.now(timezone.utc).isoformat()
        scenes = sorted([scene.model_dump() for scene in payload.scenes], key=lambda item:item['time_seconds'])
        updated = {**review, 'revision': payload.revision + 1, 'summary': payload.summary,
                   'scenes': scenes, 'updated_at': now, 'updated_by': actor_id}
        if payload.publish:
            updated['publication'] = {'summary': payload.summary, 'scenes': scenes,
                                      'published_at': now, 'published_by': actor_id}
        result['review'] = updated
        content = json.dumps(result, ensure_ascii=False)
        if len(content.encode('utf-8')) > 60000:
            raise HTTPException(422, '검수 내용이 너무 깁니다. 코멘트를 간략하게 줄여 주세요.')
        # Preserve the original AI response and raw video_event rows for review comparison.
        cursor.execute('UPDATE video_analysis SET feedback=%s WHERE analysis_id=%s', (content, analysis_id))
    connection.commit()
    return result


def published_for_video(connection, video_id):
    with connection.cursor() as cursor:
        cursor.execute('''SELECT a.analysis_id,a.feedback FROM video_analysis a
                          JOIN futsal_video v ON v.video_id=a.video_id
                          WHERE a.video_id=%s AND v.user_id=1 ORDER BY a.analysis_id DESC''', (video_id,))
        for row in cursor.fetchall():
            result = decode(row)
            publication = (result or {}).get('review', {}).get('publication')
            if not publication:
                continue
            return {'analysis_id': row['analysis_id'], 'video_id': video_id,
                    'summary': publication['summary'], 'scenes': publication['scenes'],
                    'published_at': publication['published_at'], 'ai_generated': True}
    return None
