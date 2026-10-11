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
# 14. 예정된 전체 경기 일정 조회
# GET /api/schedules
# =====================================================

@app.get("/api/schedules")
def get_all_schedules():
    connection = None

    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:
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

# public 폴더의 HTML, CSS, JavaScript 파일 제공
app.mount(
    "/",
    StaticFiles(directory="public", html=True),
    name="static"
)