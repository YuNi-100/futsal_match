"""YouTube URL registration and listing API for WGH."""
from datetime import date
from typing import Optional
from urllib.parse import urlparse, parse_qs
import re

import pymysql
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

import video_repository as repository

router = APIRouter(prefix='/api/youtube-videos', tags=['YouTube 경기 영상'])
CURRENT_USER_ID = 1  # 기존 main.py와 동일한 임시 사용자. 공개 배포 전 인증으로 교체 필요.
VIDEO_ID_PATTERN = re.compile(r'^[A-Za-z0-9_-]{11}$')


class YouTubeVideoCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    youtube_url: str
    match_date: date
    match_id: Optional[int] = Field(default=None, ge=1)


def parse_youtube_id(value: str) -> str:
    raw = value.strip()
    if VIDEO_ID_PATTERN.fullmatch(raw):
        return raw
    parsed = urlparse(raw)
    host = (parsed.hostname or '').lower()
    if parsed.scheme not in ('https', 'http'):
        raise ValueError('올바른 유튜브 URL을 입력해 주세요.')
    if host in ('youtu.be', 'www.youtu.be'):
        candidate = parsed.path.strip('/').split('/')[0]
    elif host in ('youtube.com', 'www.youtube.com', 'm.youtube.com'):
        parts = parsed.path.strip('/').split('/')
        if parts[0] == 'watch':
            candidate = parse_qs(parsed.query).get('v', [''])[0]
        elif parts[0] in ('shorts', 'live', 'embed') and len(parts) >= 2:
            candidate = parts[1]
        else:
            candidate = ''
    else:
        candidate = ''
    if not VIDEO_ID_PATTERN.fullmatch(candidate):
        raise ValueError('지원하는 유튜브 영상 링크가 아닙니다.')
    return candidate


def public_video(row):
    return {
        **row,
        'youtube_url': f'https://www.youtube.com/watch?v={row["youtube_id"]}',
        'embed_url': f'https://www.youtube.com/embed/{row["youtube_id"]}',
    }


@router.post('', status_code=201)
def register_youtube_video(payload: YouTubeVideoCreate):
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=422, detail='영상 제목을 입력해 주세요.')
    try:
        youtube_id = parse_youtube_id(payload.youtube_url)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    connection = None
    try:
        connection = repository.connect()
        if payload.match_id is not None and not repository.find_match(connection, payload.match_id, CURRENT_USER_ID):
            raise HTTPException(status_code=404, detail='연결할 경기 기록을 찾을 수 없습니다.')
        if repository.find_youtube_id(connection, youtube_id):
            raise HTTPException(status_code=409, detail='이미 등록된 유튜브 영상입니다.')
        video = repository.create_video(
            connection,
            user_id=CURRENT_USER_ID,
            match_id=payload.match_id,
            title=title,
            youtube_id=youtube_id,
            match_date=payload.match_date,
        )
        connection.commit()
        return {'success': True, 'message': '유튜브 영상이 등록되었습니다.', 'data': public_video(video)}
    except HTTPException:
        if connection:
            connection.rollback()
        raise
    except pymysql.err.IntegrityError as error:
        if connection:
            connection.rollback()
        if error.args and error.args[0] == 1062:
            raise HTTPException(status_code=409, detail='이미 등록된 유튜브 영상입니다.') from error
        print('유튜브 영상 DB 무결성 오류:', error)
        raise HTTPException(status_code=500, detail='영상 등록에 실패했습니다.') from error
    except Exception as error:
        if connection:
            connection.rollback()
        print('유튜브 영상 등록 오류:', error)
        raise HTTPException(status_code=500, detail='영상 등록에 실패했습니다.') from error
    finally:
        if connection:
            connection.close()


@router.get('')
def get_youtube_videos():
    connection = None
    try:
        connection = repository.connect()
        rows = repository.list_videos(connection, CURRENT_USER_ID)
        return {'success': True, 'data': [public_video(row) for row in rows]}
    except Exception as error:
        print('유튜브 영상 조회 오류:', error)
        raise HTTPException(status_code=500, detail='영상 목록을 불러오지 못했습니다.') from error
    finally:
        if connection:
            connection.close()
