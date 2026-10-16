"""Public, read-only match details using existing WGH tables."""
from fastapi import APIRouter, HTTPException, Path


def create_match_detail_router(get_db_connection):
    router = APIRouter()

    @router.get('/api/matches/{match_id}')
    def get_match_detail(match_id: int = Path(gt=0)):
        connection = None
        try:
            connection = get_db_connection()
            with connection.cursor() as cursor:
                cursor.execute('''SELECT match_id,
                    DATE_FORMAT(match_date,'%%Y-%%m-%%d') AS match_date,
                    opponent,our_score,opponent_score,result,location,memo,
                    TIME_FORMAT(start_time,'%%H:%%i') AS start_time,
                    TIME_FORMAT(end_time,'%%H:%%i') AS end_time
                    FROM futsal_match WHERE match_id=%s''', (match_id,))
                match = cursor.fetchone()
                if match is None:
                    raise HTTPException(404, '경기 기록을 찾을 수 없습니다.')
                cursor.execute('''SELECT p.player_id,p.player_name,p.back_number,p.position,
                    mp.goals,mp.assists FROM match_player mp
                    JOIN futsal_player p ON p.player_id=mp.player_id
                    WHERE mp.match_id=%s ORDER BY p.back_number,p.player_id''', (match_id,))
                match['players'] = list(cursor.fetchall())
                # Only explicit match_id links. Never guess based on date or title.
                cursor.execute('''SELECT video_id,title,youtube_id FROM futsal_video
                    WHERE match_id=%s AND user_id=%s ORDER BY created_at,video_id''', (match_id,1))
                match['videos'] = list(cursor.fetchall())
            return {'success': True, 'data': match}
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(500, '경기 상세 정보를 불러오지 못했습니다.') from None
        finally:
            if connection:
                connection.close()

    return router
