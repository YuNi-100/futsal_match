"""Attach or detach an existing WGH video without changing its metadata."""
from typing import Optional
from fastapi import APIRouter, HTTPException, Path
from pydantic import BaseModel, Field
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
