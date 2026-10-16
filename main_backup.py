# =====================================================
# 1. 필요한 라이브러리 불러오기
# =====================================================

import os
import pymysql

from dotenv import load_dotenv
from fastapi import FastAPI

# .env 파일의 환경변수 불러오기
load_dotenv()


# =====================================================
# 2. FastAPI 서버 생성
# =====================================================

app = FastAPI(
    title="WGH Futsal Match API",
    description="We Go High 풋살 경기 관리 시스템",
    version="1.0.0"
)


# =====================================================
# 3. MySQL 연결 함수
# =====================================================

def get_db_connection():

    connection = pymysql.connect(
        host=os.getenv("DB_HOST"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME"),
        port=int(os.getenv("DB_PORT", "3306")),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor
    )

    return connection


# =====================================================
# 4. FastAPI 서버 연결 테스트
# GET /api
# =====================================================

@app.get("/api")
def home():

    return {
        "success": True,
        "message": "WGH FastAPI 서버 연결 성공!"
    }


# =====================================================
# 5. MySQL 데이터베이스 연결 테스트
# GET /api/db-test
# =====================================================

@app.get("/api/db-test")
def db_test():

    try:
        connection = get_db_connection()

        try:
            with connection.cursor() as cursor:

                # 현재 연결된 데이터베이스 확인
                cursor.execute("SELECT DATABASE() AS db_name")
                result = cursor.fetchone()

            return {
                "success": True,
                "message": "WGH MySQL 연결 성공!",
                "database": result["db_name"]
            }

        finally:
            connection.close()

    except Exception as error:

        # 오류 내용은 서버 터미널에서만 확인
        print("MySQL 연결 실패:", error)

        return {
            "success": False,
            "message": "MySQL 데이터베이스 연결 실패"
        }

    # =====================================================
# 6. 선수 목록 조회 API
# GET /api/players
# =====================================================

@app.get("/api/players")
def get_players():

    try:
        connection = get_db_connection()

        try:
            with connection.cursor() as cursor:

                # 선수 정보와 누적 경기 기록 조회
                cursor.execute("""
                    SELECT
                        p.player_id,
                        p.player_name,
                        p.back_number,
                        p.position,
                        COUNT(mp.match_player_id) AS appearances,
                        COALESCE(SUM(mp.goals), 0) AS goals,
                        COALESCE(SUM(mp.assists), 0) AS assists
                    FROM futsal_player p
                    LEFT JOIN match_player mp
                        ON p.player_id = mp.player_id
                    GROUP BY
                        p.player_id,
                        p.player_name,
                        p.back_number,
                        p.position
                    ORDER BY p.back_number ASC
                """)

                players = cursor.fetchall()

            return {
                "success": True,
                "data": players
            }

        finally:
            connection.close()

    except Exception as error:
        print("선수 목록 조회 실패:", error)

        return {
            "success": False,
            "message": "선수 목록을 불러오지 못했습니다."
        }

    # =====================================================
# 7. 경기 기록 조회 API
# GET /api/matches
# =====================================================

@app.get("/api/matches")
def get_matches():

    try:
        connection = get_db_connection()

        try:
            with connection.cursor() as cursor:

                # 기존 경기 기록을 날짜 최신순으로 조회
                cursor.execute("""
                    SELECT
                        match_id,
                        DATE_FORMAT(match_date, '%Y-%m-%d') AS match_date,
                        opponent,
                        our_score,
                        opponent_score,
                        location,
                        result,
                        memo
                    FROM futsal_match
                    ORDER BY match_date DESC
                """)

                matches = cursor.fetchall()

            return {
                "success": True,
                "data": matches
            }

        finally:
            connection.close()

    except Exception as error:

        print("경기 기록 조회 실패:", error)

        return {
            "success": False,
            "message": "경기 기록을 불러오지 못했습니다."
        }

    # =====================================================
# 8. 경기 기록 등록 API
# POST /api/matches
# =====================================================

from fastapi import HTTPException
from pydantic import BaseModel, Field
from datetime import date
from typing import Optional


# 경기 기록 등록 시 전달받을 데이터 형식
class MatchCreate(BaseModel):
    match_date: date                  # 경기 날짜 (필수)
    opponent: str                     # 상대팀 (필수)
    our_score: int = Field(ge=0)      # 우리팀 점수 (0 이상)
    opponent_score: int = Field(ge=0) # 상대팀 점수 (0 이상)
    location: Optional[str] = None    # 경기 장소 (선택)
    memo: Optional[str] = None        # 메모 (선택)


@app.post("/api/matches", status_code=201)
def create_match(match: MatchCreate):

    # 승리 / 무승부 / 패배 자동 판정
    if match.our_score > match.opponent_score:
        result = "win"

    elif match.our_score < match.opponent_score:
        result = "lose"

    else:
        result = "draw"

    connection = None

    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:

            # MySQL에 경기 기록 저장
            sql = """
                INSERT INTO futsal_match (
                    user_id,
                    match_date,
                    opponent,
                    our_score,
                    opponent_score,
                    location,
                    result,
                    memo
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """

            cursor.execute(sql, (
                1,
                match.match_date,
                match.opponent,
                match.our_score,
                match.opponent_score,
                match.location,
                result,
                match.memo
            ))

            new_match_id = cursor.lastrowid

        connection.commit()

        return {
            "success": True,
            "message": "경기 기록이 등록되었습니다.",
            "data": {
                "match_id": new_match_id,
                "match_date": str(match.match_date),
                "opponent": match.opponent,
                "our_score": match.our_score,
                "opponent_score": match.opponent_score,
                "location": match.location,
                "result": result,
                "memo": match.memo
            }
        }

    except Exception as error:

        if connection:
            connection.rollback()

        print("경기 기록 등록 실패:", error)

        raise HTTPException(
            status_code=500,
            detail="경기 기록을 저장하지 못했습니다."
        )

    finally:
        if connection:
            connection.close()

            # =====================================================
# 9. 경기 기록 수정 API
# PUT /api/matches/{match_id}
# =====================================================

@app.put("/api/matches/{match_id}")
def update_match(match_id: int, match: MatchCreate):

    # 승패 자동 계산
    if match.our_score > match.opponent_score:
        result = "win"
    elif match.our_score < match.opponent_score:
        result = "lose"
    else:
        result = "draw"

    connection = None

    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:

            # 기존 경기 기록 수정
            cursor.execute("""
                UPDATE futsal_match
                SET
                    match_date = %s,
                    opponent = %s,
                    our_score = %s,
                    opponent_score = %s,
                    location = %s,
                    result = %s,
                    memo = %s
                WHERE match_id = %s
                  AND user_id = %s
            """, (
                match.match_date,
                match.opponent,
                match.our_score,
                match.opponent_score,
                match.location,
                result,
                match.memo,
                match_id,
                1
            ))

            updated_rows = cursor.rowcount

        if updated_rows == 0:
            connection.rollback()
            raise HTTPException(
                status_code=404,
                detail="수정할 경기 기록이 없습니다."
            )

        connection.commit()

        return {
            "success": True,
            "message": "경기 기록이 수정되었습니다.",
            "data": {
                "match_id": match_id,
                "match_date": str(match.match_date),
                "opponent": match.opponent,
                "our_score": match.our_score,
                "opponent_score": match.opponent_score,
                "location": match.location,
                "result": result,
                "memo": match.memo
            }
        }

    except HTTPException:
        raise

    except Exception as error:
        if connection:
            connection.rollback()

        print("경기 기록 수정 실패:", error)

        raise HTTPException(
            status_code=500,
            detail="경기 기록 수정에 실패했습니다."
        )

    finally:
        if connection:
            connection.close()


            # =====================================================
# 10. 경기 기록 삭제 API
# DELETE /api/matches/{match_id}
# =====================================================

@app.delete("/api/matches/{match_id}")
def delete_match(match_id: int):

    connection = None

    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:

            # 삭제할 경기 기록이 존재하는지 확인
            cursor.execute("""
                SELECT match_id
                FROM futsal_match
                WHERE match_id = %s
                  AND user_id = %s
            """, (match_id, 1))

            existing_match = cursor.fetchone()

            if existing_match is None:
                raise HTTPException(
                    status_code=404,
                    detail="삭제할 경기 기록이 없습니다."
                )

            # 경기와 연결된 선수 출전 기록 먼저 삭제
            cursor.execute("""
                DELETE FROM match_player
                WHERE match_id = %s
            """, (match_id,))

            # 경기 기록 삭제
            cursor.execute("""
                DELETE FROM futsal_match
                WHERE match_id = %s
                  AND user_id = %s
            """, (match_id, 1))

        connection.commit()

        return {
            "success": True,
            "message": "경기 기록이 삭제되었습니다.",
            "match_id": match_id
        }

    except HTTPException:
        if connection:
            connection.rollback()
        raise

    except Exception as error:
        if connection:
            connection.rollback()

        print("경기 기록 삭제 실패:", error)

        raise HTTPException(
            status_code=500,
            detail="경기 기록 삭제에 실패했습니다."
        )

    finally:
        if connection:
            connection.close()

            # =====================================================
# 11. 다가오는 경기 일정 조회 API
# GET /api/schedules/next
# =====================================================

@app.get("/api/schedules/next")
def get_next_schedule():

    connection = None

    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:

            # 오늘 이후의 경기 중 가장 가까운 일정 1건 조회
            cursor.execute("""
                SELECT
                    schedule_id,
                    DATE_FORMAT(match_date, '%%Y-%%m-%%d') AS match_date,
                    TIME_FORMAT(start_time, '%%H:%%i') AS start_time,
                    TIME_FORMAT(end_time, '%%H:%%i') AS end_time,
                    opponent,
                    location,
                    memo
                FROM futsal_schedule
                WHERE user_id = %s
                  AND match_date >= CURDATE()
                ORDER BY match_date ASC, start_time ASC
                LIMIT 1
            """, (1,))

            schedule = cursor.fetchone()

        return {
            "success": True,
            "data": schedule
        }

    except Exception as error:
        print("경기 일정 조회 실패:", error)

        raise HTTPException(
            status_code=500,
            detail="경기 일정을 불러오지 못했습니다."
        )

    finally:
        if connection:
            connection.close()

            # =====================================================
# 12. 경기 일정 등록 API
# POST /api/schedules
# =====================================================

from datetime import time


# 경기 일정 등록 시 전달받을 데이터 형식
class ScheduleCreate(BaseModel):
    match_date: date                  # 경기 날짜 (필수)
    start_time: time                  # 시작시간 (필수)
    end_time: time                    # 종료시간 (필수)
    opponent: str                     # 상대팀 (필수)
    location: Optional[str] = None    # 경기 장소 (선택)
    memo: Optional[str] = None        # 메모 (선택)


@app.post("/api/schedules", status_code=201)
def create_schedule(schedule: ScheduleCreate):

    # 종료시간이 시작시간보다 늦어야 함
    if schedule.end_time <= schedule.start_time:
        raise HTTPException(
            status_code=400,
            detail="종료시간은 시작시간보다 늦어야 합니다."
        )

    # 상대팀 이름 확인
    if not schedule.opponent.strip():
        raise HTTPException(
            status_code=400,
            detail="상대팀 이름을 입력해 주세요."
        )

    connection = None

    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:

            # 새로운 경기 일정 저장
            cursor.execute("""
                INSERT INTO futsal_schedule (
                    user_id,
                    match_date,
                    start_time,
                    end_time,
                    opponent,
                    location,
                    memo
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                1,
                schedule.match_date,
                schedule.start_time,
                schedule.end_time,
                schedule.opponent.strip(),
                schedule.location,
                schedule.memo
            ))

            new_schedule_id = cursor.lastrowid

        connection.commit()

        return {
            "success": True,
            "message": "경기 일정이 등록되었습니다.",
            "data": {
                "schedule_id": new_schedule_id,
                "match_date": str(schedule.match_date),
                "start_time": schedule.start_time.strftime("%H:%M"),
                "end_time": schedule.end_time.strftime("%H:%M"),
                "opponent": schedule.opponent.strip(),
                "location": schedule.location,
                "memo": schedule.memo
            }
        }

    except Exception as error:
        if connection:
            connection.rollback()

        print("경기 일정 등록 실패:", error)

        raise HTTPException(
            status_code=500,
            detail="경기 일정 등록에 실패했습니다."
        )

    finally:
        if connection:
            connection.close()

            # =====================================================
# 13. 기존 홈페이지 연결
# =====================================================

from fastapi.staticfiles import StaticFiles

# =====================================================
# 15. 다음 경기 일정 수정 API
# PUT /api/schedules/{schedule_id}
# =====================================================


# =====================================================
# 12. 경기 일정 수정 API
# PUT /api/schedules/{schedule_id}
# =====================================================

@app.put("/api/schedules/{schedule_id}")
def update_schedule(schedule_id: int, schedule: ScheduleCreate):

    # 종료 시간이 시작 시간보다 늦어야 함
    if schedule.end_time <= schedule.start_time:
        raise HTTPException(
            status_code=400,
            detail="종료시간은 시작시간보다 늦어야 합니다."
        )

    # 상대팀 이름 필수
    if not schedule.opponent.strip():
        raise HTTPException(
            status_code=400,
            detail="상대팀 이름을 입력해 주세요."
        )

    connection = None

    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:

            # 기존 일정 수정
            # schedule_id: 수정할 일정 번호
            # user_id = 1: 현재 WGH 사용자
            cursor.execute("""
                UPDATE futsal_schedule
                SET
                    match_date = %s,
                    start_time = %s,
                    end_time = %s,
                    opponent = %s,
                    location = %s,
                    memo = %s
                WHERE schedule_id = %s
                  AND user_id = %s
            """, (
                schedule.match_date,
                schedule.start_time,
                schedule.end_time,
                schedule.opponent.strip(),
                schedule.location,
                schedule.memo,
                schedule_id,
                1
            ))

            # 수정할 일정이 존재하지 않는 경우
            if cursor.rowcount == 0:
                cursor.execute("""
                    SELECT schedule_id
                    FROM futsal_schedule
                    WHERE schedule_id = %s
                      AND user_id = %s
                """, (schedule_id, 1))

                if cursor.fetchone() is None:
                    raise HTTPException(
                        status_code=404,
                        detail="수정할 경기 일정이 없습니다."
                    )

        connection.commit()

        return {
            "success": True,
            "message": "경기 일정이 수정되었습니다."
        }

    except HTTPException:
        if connection:
            connection.rollback()
        raise

    except Exception as error:
        if connection:
            connection.rollback()

        print("경기 일정 수정 실패:", error)

        raise HTTPException(
            status_code=500,
            detail="경기 일정 수정에 실패했습니다."
        )

    finally:
        if connection:
            connection.close()



# =====================================================
# 13. 경기 일정 삭제 API
# DELETE /api/schedules/{schedule_id}
# =====================================================

@app.delete("/api/schedules/{schedule_id}")
def delete_schedule(schedule_id: int):

    connection = None

    try:
        # MySQL 데이터베이스 연결
        connection = get_db_connection()

        with connection.cursor() as cursor:

            # 일정 번호와 사용자 번호가 일치하는 일정만 삭제
            cursor.execute("""
                DELETE FROM futsal_schedule
                WHERE schedule_id = %s
                  AND user_id = %s
            """, (schedule_id, 1))

            # 삭제할 일정이 존재하지 않는 경우
            if cursor.rowcount == 0:
                raise HTTPException(
                    status_code=404,
                    detail="삭제할 경기 일정을 찾을 수 없습니다."
                )

        # 삭제 확정
        connection.commit()

        return {
            "success": True,
            "message": "경기 일정이 삭제되었습니다."
        }

    except HTTPException:
        if connection:
            connection.rollback()
        raise

    except Exception as error:
        if connection:
            connection.rollback()

        print("경기 일정 삭제 실패:", error)

        raise HTTPException(
            status_code=500,
            detail="경기 일정 삭제에 실패했습니다."
        )

    finally:
        if connection:
            connection.close()


# =====================================================
# 14. 예정된 전체 경기 일정 조회 API
# GET /api/schedules
# =====================================================

@app.get("/api/schedules")
def get_all_schedules():

    connection = None

    try:
        # MySQL 데이터베이스 연결
        connection = get_db_connection()

        with connection.cursor() as cursor:

            # 오늘 이후의 경기 일정만 조회
            # user_id = 1: 현재 WGH 사용자
            cursor.execute("""
                SELECT
                    schedule_id,
                    DATE_FORMAT(match_date, '%%Y-%%m-%%d') AS match_date,
                    TIME_FORMAT(start_time, '%%H:%%i') AS start_time,
                    TIME_FORMAT(end_time, '%%H:%%i') AS end_time,
                    opponent,
                    location,
                    memo
                FROM futsal_schedule
                WHERE user_id = %s
                  AND match_date >= CURDATE()
                ORDER BY match_date ASC, start_time ASC
            """, (1,))

            schedules = cursor.fetchall()

        # 기존 app.js와 동일한 응답 구조 유지
        return {
            "success": True,
            "data": schedules
        }

    except Exception as error:
        print("전체 경기 일정 조회 실패:", error)

        raise HTTPException(
            status_code=500,
            detail="경기 일정을 불러오지 못했습니다."
        )

    finally:
        if connection:
            connection.close()


# =====================================================
# 15. 정적 파일 제공
# HTML / CSS / JavaScript
# 반드시 API 코드보다 아래에 배치
# =====================================================

# =====================================================
# 16. 경기 영상 업로드 및 목록 조회 API
# =====================================================

import uuid
import json
from pathlib import Path
from fastapi import UploadFile, File
from fastapi.responses import FileResponse

# 영상 저장 폴더 생성
VIDEO_DIR = Path("uploads/videos")
VIDEO_DIR.mkdir(parents=True, exist_ok=True)

# 업로드 영상 정보 저장 파일
VIDEO_DB_FILE = VIDEO_DIR / "videos.json"


# 저장된 영상 목록 읽기
def load_videos():
    if not VIDEO_DB_FILE.exists():
        return []

    with open(VIDEO_DB_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


# 영상 목록 저장하기
def save_videos(videos):
    with open(VIDEO_DB_FILE, "w", encoding="utf-8") as f:
        json.dump(videos, f, ensure_ascii=False, indent=2)


# 경기 영상 업로드
@app.post("/api/videos/upload", status_code=201)
async def upload_match_video(file: UploadFile = File(...)):

    # 영상 파일인지 확인
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(
            status_code=400,
            detail="영상 파일만 업로드할 수 있습니다."
        )

    video_id = uuid.uuid4().hex
    extension = Path(file.filename or "").suffix.lower()

    # 서버에 저장할 파일명
    stored_name = video_id + extension
    video_path = VIDEO_DIR / stored_name

    # 영상을 나누어 저장 (큰 파일도 메모리에 한꺼번에 올리지 않음)
    try:
        with open(video_path, "wb") as output:
            while chunk := await file.read(1024 * 1024):
                output.write(chunk)
    finally:
        await file.close()

    # 영상 목록에 등록
    videos = load_videos()

    video_info = {
        "video_id": video_id,
        "filename": file.filename,
        "stored_name": stored_name,
        "url": f"/api/videos/{video_id}"
    }

    videos.insert(0, video_info)
    save_videos(videos)

    return {
        "success": True,
        "message": "경기 영상이 업로드되었습니다.",
        "data": video_info
    }


# 업로드된 경기 영상 목록 조회
@app.get("/api/videos")
def get_match_videos():
    return {
        "success": True,
        "data": load_videos()
    }


# 업로드된 경기 영상 재생
@app.get("/api/videos/{video_id}")
def play_match_video(video_id: str):

    videos = load_videos()
    video = next(
        (item for item in videos if item["video_id"] == video_id),
        None
    )

    if video is None:
        raise HTTPException(status_code=404, detail="영상을 찾을 수 없습니다.")

    video_path = VIDEO_DIR / video["stored_name"]

    if not video_path.is_file():
        raise HTTPException(status_code=404, detail="영상 파일이 없습니다.")

    return FileResponse(video_path)


# =====================================================
# 17. Gemini AI 연결 테스트
# GET /api/ai/test
# =====================================================

from google import genai

@app.get("/api/ai/test")
def test_gemini_connection():

    # .env에서 API 키 불러오기
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="Gemini API 키가 없습니다."
        )

    try:
        # Gemini 연결
        client = genai.Client(api_key=api_key)

        # AI 응답 테스트
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents="WGH 풋살팀 AI 분석 연결 성공 메시지를 한국어로 짧게 작성해줘."
        )

        return {
            "success": True,
            "message": "Gemini AI 연결 성공!",
            "ai_response": response.text
        }

    
    except Exception as error:

        # Gemini API 오류 상세 내용 확인
        print("Gemini 연결 오류:", type(error).__name__)
        print("Gemini 상세 오류:", str(error))

        raise HTTPException(
            status_code=502,
            detail="Gemini 연결에 실패했습니다."
        )


# =====================================================
# 18. Gemini AI 경기 영상 분석 API
# POST /api/videos/{video_id}/analyze
# =====================================================

import time
from google import genai
from google.genai import types

# =====================================================
# AI 분석용 영상 자동 압축
# 원본 영상은 변경하지 않음
# =====================================================

import subprocess

# Gemini 업로드 제한보다 여유 있게 설정
MAX_AI_VIDEO_BYTES = 1500 * 1024 * 1024  # 1,500MiB


def compress_video_for_ai(video_path, video_id):

    # 압축 파일은 원본과 다른 이름으로 저장
    compressed_path = VIDEO_DIR / f"{video_id}_ai.mp4"

    # 이전 분석 실패 후 남겨 둔 압축 파일을 재사용
    if compressed_path.is_file():
        cached_size = compressed_path.stat().st_size
        if 0 < cached_size <= MAX_AI_VIDEO_BYTES:
            print("기존 AI 압축 영상 재사용:", round(cached_size / (1024 ** 2), 2), "MB")
            return compressed_path
        compressed_path.unlink(missing_ok=True)

    print("AI 영상 압축 시작:", video_path.name)

    command = [
        "ffmpeg",
        "-y",
        "-i", str(video_path),

        # 분석용 영상 해상도: 가로 최대 1280px
        # 세로 해상도는 원본 비율에 맞게 자동 조절
        "-vf", "scale=w='min(1280,iw)':h=-2",

        # H.264 영상 압축
        "-c:v", "libx264",
        "-preset", "fast",
        "-b:v", "1800k",

        # 오디오 압축
        "-c:a", "aac",
        "-b:a", "96k",

        # 분석용 영상 생성
        str(compressed_path)
    ]

    try:
        subprocess.run(
            command,
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )

        compressed_size = compressed_path.stat().st_size

        print(
            "AI 영상 압축 완료:",
            round(compressed_size / (1024 ** 2), 2),
            "MB"
        )

        # Gemini 업로드 제한보다 큰 경우 전송 차단
        if compressed_size > MAX_AI_VIDEO_BYTES:
            raise RuntimeError(
                "압축 영상이 1,500MiB를 초과했습니다."
            )

        return compressed_path

    except Exception:
        # 압축 실패 시 생성 중이던 임시 파일 삭제
        compressed_path.unlink(missing_ok=True)
        raise


@app.post("/api/videos/{video_id}/analyze")
def analyze_match_video(video_id: str):

    # 1. 기존 영상 목록에서 분석할 영상 찾기
    videos = load_videos()

    video = next(
        (item for item in videos if item["video_id"] == video_id),
        None
    )

    if video is None:
        raise HTTPException(
            status_code=404,
            detail="분석할 영상을 찾을 수 없습니다."
        )

    # 2. 실제 영상 파일 확인
    video_path = VIDEO_DIR / video["stored_name"]

    if not video_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="영상 파일이 존재하지 않습니다."
        )

    # 3. Gemini API 키 확인
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="Gemini API 키가 없습니다."
        )

    client = genai.Client(api_key=api_key)
    uploaded_file = None
    compressed_path = None
    analysis_succeeded = False

    try:
        # 4. 압축 영상 생성 또는 기존 압축 영상 재사용
        compressed_path = compress_video_for_ai(video_path, video_id)
        print("AI 압축 영상 업로드 시작:", compressed_path.name)

        uploaded_file = client.files.upload(
            file=str(compressed_path)
        )

        # 5. 영상 처리 완료 대기 (최대 5분)
        for _ in range(60):

            state = uploaded_file.state

            if state == "ACTIVE":
                break

            if state == "FAILED":
                raise RuntimeError(
                    "Gemini 영상 처리에 실패했습니다."
                )

            time.sleep(5)

            uploaded_file = client.files.get(
                name=uploaded_file.name
            )

        else:
            raise TimeoutError(
                "영상 처리 대기 시간이 초과되었습니다."
            )

        # 6. AI에게 경기 분석 요청
        prompt = """
너는 WGH 여자 풋살팀의 전문 경기 분석 코치야.

제공된 경기 영상을 분석해 줘.

분석 항목:
1. 골 장면
2. 슈팅 장면
3. 주요 수비 장면
4. 공격 및 수비 전술 피드백

영상에서 실제 확인할 수 있는 장면만 기록해.
확실하지 않은 장면은 추측하지 마.
영상 시작을 00:00으로 하여 시간을 기록해.

다음 JSON 형식으로만 답변해.

{
  "summary": "전체 경기 요약",
  "events": [
    {
      "time": "00:00",
      "type": "goal 또는 shot 또는 defense",
      "description": "장면 설명"
    }
  ],
  "feedback": "WGH 팀을 위한 코치 피드백"
}
"""

        print("Gemini AI 경기 분석 시작")

        
        # Gemini 서버 과부하 시 자동 재시도
        from google.genai.errors import ServerError

        response = None

        max_attempts = 5
        for attempt in range(max_attempts):

            try:
                print(f"AI 분석 요청 {attempt + 1}/{max_attempts}")

                response = client.models.generate_content(
                    model=os.getenv(
                        "GEMINI_MODEL",
                        "gemini-3-flash-preview"
                    ),
                    contents=[uploaded_file, prompt],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json"
                    )
                )

                # 정상 응답이면 반복 종료
                break

            except ServerError as error:

                # 503 이외의 서버 오류는 즉시 전달
                if error.code != 503:
                    raise

                # 마지막 시도까지 실패한 경우
                if attempt == max_attempts - 1:
                    raise

                # 서버 혼잡이 계속되면 점진적으로 대기
                wait_seconds = min(15 * (2 ** attempt), 120)

                print(
                    f"Gemini 서버 혼잡. "
                    f"{wait_seconds}초 후 재시도..."
                )

                time.sleep(wait_seconds)


        if not response.text:
            raise RuntimeError("AI 분석 결과가 비어 있습니다.")

        # 7. AI 응답을 JSON 데이터로 변환
        analysis = json.loads(response.text)

        print("Gemini AI 경기 분석 완료!")
        analysis_succeeded = True

        return {
            "success": True,
            "message": "AI 경기 분석이 완료되었습니다.",
            "video_id": video_id,
            "filename": video["filename"],
            "analysis": analysis
        }

    except Exception as error:

        print(
            "AI 영상 분석 오류:",
            type(error).__name__,
            str(error)
        )

        raise HTTPException(
            status_code=502,
            detail="AI 경기 분석에 실패했습니다. 서버 로그를 확인해 주세요."
        )

    finally:
        # Gemini에 임시 업로드한 파일 삭제 시도
        if uploaded_file is not None:
            try:
                client.files.delete(name=uploaded_file.name)
            except Exception as cleanup_error:
                print("Gemini 임시 파일 정리 실패:", cleanup_error)

        client.close()

        # 분석에 성공했을 때만 로컬 압축 파일 삭제
        # 실패했다면 다음 요청에서 재사용하도록 남겨 둠
        if compressed_path is not None and analysis_succeeded:
            compressed_path.unlink(missing_ok=True)
            print("AI 압축 영상 정리 완료")
        elif compressed_path is not None:
            print("분석 실패: AI 압축 영상 보관:", compressed_path.name)


app.mount(
    "/",
    StaticFiles(directory="public", html=True),
    name="static"
)
