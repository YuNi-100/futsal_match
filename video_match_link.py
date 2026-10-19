"""Attach or detach an existing WGH video without changing its metadata."""
from typing import Optional
from fastapi import APIRouter, HTTPException, Path
from pydantic import BaseModel, Field, field_validator
import pymysql
import video_repository as repository

router=APIRouter(prefix='/api/youtube-videos',tags=['경기 영상 연결'])


class VideoMatchLink(BaseModel):
    match_id: Optional[int] = Field(...,gt=0,strict=True)


@router.patch('/{video_id}/match')
def link_video_match(payload: VideoMatchLink,video_id: int=Path(gt=0)):
    connection=None
    try:
        connection=repository.connect()
        with connection.cursor() as cursor:
            cursor.execute('SELECT video_id FROM futsal_video WHERE video_id=%s AND user_id=%s FOR UPDATE',(video_id,1))
            if cursor.fetchone() is None:
                raise HTTPException(404,'연결을 변경할 영상을 찾을 수 없습니다.')
            if payload.match_id is not None:
                cursor.execute('SELECT match_id FROM futsal_match WHERE match_id=%s AND user_id=%s FOR UPDATE',(payload.match_id,1))
                if cursor.fetchone() is None:
                    raise HTTPException(404,'연결할 경기 기록을 찾을 수 없습니다.')
            cursor.execute('UPDATE futsal_video SET match_id=%s WHERE video_id=%s AND user_id=%s',(payload.match_id,video_id,1))
        connection.commit()
        return {'success':True,'data':{'video_id':video_id,'match_id':payload.match_id}}
    except HTTPException:
        if connection:connection.rollback()
        raise
    except pymysql.MySQLError:
        if connection:connection.rollback()
        raise HTTPException(500,'경기 영상 연결을 저장하지 못했습니다.') from None
    finally:
        if connection:connection.close()


def attach_video_to_new_match(cursor, match_id, video_id):
    """Caller saves match, players and video link in one transaction."""
    if video_id is None:
        return
    cursor.execute('SELECT video_id,match_id FROM futsal_video WHERE video_id=%s AND user_id=%s FOR UPDATE',(video_id,1))
    video=cursor.fetchone()
    if video is None:
        raise HTTPException(404,'선택한 경기 영상을 찾을 수 없습니다.')
    if video['match_id'] is not None and video['match_id'] != match_id:
        raise HTTPException(409,'이미 다른 경기에 연결된 영상입니다. 연결 관리에서 확인해 주세요.')
    cursor.execute('UPDATE futsal_video SET match_id=%s WHERE video_id=%s AND user_id=%s',(match_id,video_id,1))


@router.delete('/{video_id}')
def delete_registered_video(video_id: int=Path(gt=0)):
    """Delete WGH metadata only. Existing FK rules remove video analysis children."""
    connection=None
    try:
        connection=repository.connect()
        with connection.cursor() as cursor:
            cursor.execute('SELECT video_id FROM futsal_video WHERE video_id=%s AND user_id=%s FOR UPDATE',(video_id,1))
            if cursor.fetchone() is None:
                raise HTTPException(404,'삭제할 등록 영상을 찾을 수 없습니다.')
            cursor.execute('DELETE FROM futsal_video WHERE video_id=%s AND user_id=%s',(video_id,1))
        connection.commit()
        return {'success':True,'message':'홈페이지 영상 등록 정보를 삭제했습니다.','data':{'video_id':video_id}}
    except HTTPException:
        if connection:connection.rollback()
        raise
    except pymysql.err.IntegrityError:
        if connection:connection.rollback()
        raise HTTPException(409,'다른 정보에서 참조 중인 영상입니다. 연결 상태를 확인해 주세요.') from None
    except pymysql.MySQLError:
        if connection:connection.rollback()
        raise HTTPException(500,'영상 등록 정보를 삭제하지 못했습니다.') from None
    finally:
        if connection:connection.close()


class VideoTitleUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=200, strict=True)

    @field_validator('title')
    @classmethod
    def trim_title(cls, value):
        value = value.strip()
        if not value:
            raise ValueError('영상 제목을 입력해 주세요.')
        return value


@router.patch('/{video_id}/title')
def update_video_title(payload: VideoTitleUpdate, video_id: int = Path(gt=0)):
    """Rename website metadata without changing the YouTube source or records."""
    connection = None
    try:
        connection = repository.connect()
        with connection.cursor() as cursor:
            cursor.execute('SELECT video_id FROM futsal_video WHERE video_id=%s AND user_id=%s FOR UPDATE', (video_id, 1))
            if cursor.fetchone() is None:
                raise HTTPException(404, '수정할 등록 영상을 찾을 수 없습니다.')
            cursor.execute('UPDATE futsal_video SET title=%s WHERE video_id=%s AND user_id=%s', (payload.title, video_id, 1))
        connection.commit()
        return {'success': True, 'message': '영상 제목을 수정했습니다.', 'data': {'video_id': video_id, 'title': payload.title}}
    except HTTPException:
        if connection: connection.rollback()
        raise
    except pymysql.MySQLError:
        if connection: connection.rollback()
        raise HTTPException(500, '영상 제목을 수정하지 못했습니다.') from None
    finally:
        if connection: connection.close()
