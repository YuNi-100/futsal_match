# =====================================================
# 1. 필요한 라이브러리 불러오기
# =====================================================

import os
import pymysql

from dotenv import load_dotenv
from src.paths import PROJECT_ROOT
from fastapi import FastAPI, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from src.auth.auth import router as auth_router, require_admin_for_request

# .env 파일의 환경변수 불러오기
load_dotenv(PROJECT_ROOT / ".env")


# =====================================================
# 2. FastAPI 서버 생성
# =====================================================

app = FastAPI(
    title="WGH Futsal Match API",
    dependencies=[Depends(require_admin_for_request)],
    description="We Go High 풋살 경기 관리 시스템",
    version="1.0.0"
)


# =====================================================
# 3. MySQL 연결 함수
# =====================================================

def get_db_connection():
    from src.db.database import connect
    return connect()


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
def get_matches(league_id: int | None = None,unassigned: bool = False):

    try:
        connection = get_db_connection()

        try:
            with connection.cursor() as cursor:

                if league_id is not None and unassigned:
                    raise HTTPException(422,'리그와 미지정 필터를 동시에 선택할 수 없습니다.')
                if league_id is not None and league_id <= 0:
                    raise HTTPException(422,'리그를 확인해 주세요.')
                where = ' WHERE m.league_id=%s' if league_id is not None else (' WHERE m.league_id IS NULL' if unassigned else '')
                params = (league_id,) if league_id is not None else ()
                # LEFT JOIN preserves all historical, unassigned matches.
                cursor.execute("""
                    SELECT
                        m.match_id,
                        DATE_FORMAT(m.match_date, '%Y-%m-%d') AS match_date,
                        m.opponent,m.our_score,m.opponent_score,m.location,m.result,m.memo,
                        m.league_id,l.name AS league_name,
                        (SELECT team_name FROM club_settings WHERE settings_id=1) AS team_name
                    FROM futsal_match m LEFT JOIN league l ON l.league_id=m.league_id
                """ + where + ' ORDER BY m.match_date DESC,m.match_id DESC', params)

                matches = cursor.fetchall()

            return {
                "success": True,
                "data": matches
            }

        finally:
            connection.close()

    except HTTPException:
        raise
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
from src.services.match_player_records import MatchPlayerRecord, save_match_players, read_match_players

from typing import Literal
from pydantic import field_validator, model_validator


from src.auth.auth_store import set_player_member


class PlayerCreate(BaseModel):
    member_user_id: Optional[int] = Field(default=None, gt=0, strict=True)
    player_name: str = Field(min_length=1, max_length=50)
    back_number: int = Field(ge=0, strict=True)
    position: Literal['GK','FIXO','ALA','PIVO']
    joined_at: Optional[date] = None

    @field_validator('player_name')
    @classmethod
    def clean_name(cls,value):
        value=value.strip()
        if not value:
            raise ValueError('선수 이름을 입력해 주세요.')
        return value


@app.post('/api/players', status_code=201)
def create_player(player: PlayerCreate, request: Request = None):
    connection=None
    try:
        connection=get_db_connection()
        with connection.cursor() as cursor:
            cursor.execute('INSERT INTO futsal_player (player_name,back_number,position,joined_at) VALUES (%s,%s,%s,%s)',(player.player_name,player.back_number,player.position,player.joined_at))
            player_id=cursor.lastrowid
            if player.member_user_id is not None:
                actor=getattr(request.state,"wgh_user",None) if request else None
                set_player_member(cursor,player_id,player.member_user_id,actor["user_id"] if actor else None)
        connection.commit()
        return {'success':True,'data':{'player_id':player_id,**player.model_dump()}}
    except HTTPException:
        if connection:connection.rollback()
        raise
    except pymysql.err.IntegrityError as error:
        if connection:connection.rollback()
        if error.args and error.args[0]==1062:
            if 'uq_wgh_player_account_user' in str(error):
                raise HTTPException(409,'이미 다른 선수에 연결된 회원입니다.') from None
            raise HTTPException(409,'이미 사용 중인 등번호입니다.') from None
        raise HTTPException(500,'선수 등록에 실패했습니다.') from None
    except Exception:
        if connection:connection.rollback()
        raise HTTPException(500,'선수 등록에 실패했습니다.') from None
    finally:
        if connection:connection.close()





@app.get('/api/admin/members')
def get_member_choices():
    connection=None
    try:
        connection=get_db_connection()
        with connection.cursor() as cursor:
            cursor.execute('SELECT u.user_id,u.name,u.email,pa.player_id FROM app_user u JOIN wgh_google_identity g ON g.user_id=u.user_id LEFT JOIN wgh_player_account pa ON pa.user_id=u.user_id ORDER BY u.name,u.user_id')
            members=list(cursor.fetchall())
        return {'success':True,'data':members}
    except pymysql.MySQLError:
        raise HTTPException(503,'회원 목록을 불러오지 못했습니다.') from None
    finally:
        if connection:connection.close()


class PlayerMemberLink(BaseModel):
    user_id: Optional[int] = Field(...,gt=0,strict=True)


@app.patch('/api/admin/players/{player_id}/member')
def update_player_member(player_id: int, body: PlayerMemberLink, request: Request):
    if player_id<=0:raise HTTPException(422,'선수 번호를 확인해 주세요.')
    connection=None
    try:
        connection=get_db_connection()
        with connection.cursor() as cursor:
            cursor.execute('SELECT player_id FROM futsal_player WHERE player_id=%s FOR UPDATE',(player_id,))
            if cursor.fetchone() is None:raise HTTPException(404,'선수를 찾을 수 없습니다.')
            actor=request.state.wgh_user
            set_player_member(cursor,player_id,body.user_id,actor['user_id'])
        connection.commit()
        return {'success':True,'data':{'player_id':player_id,'user_id':body.user_id}}
    except HTTPException:
        if connection:connection.rollback()
        raise
    except pymysql.err.IntegrityError:
        if connection:connection.rollback()
        raise HTTPException(409,'회원 연결이 변경되었습니다. 다시 확인해 주세요.') from None
    except pymysql.MySQLError:
        if connection:connection.rollback()
        raise HTTPException(503,'회원 연결을 저장하지 못했습니다.') from None
    finally:
        if connection:connection.close()


# 경기 기록 등록 시 전달받을 데이터 형식
class MatchCreate(BaseModel):
    league_id: Optional[int] = Field(default=None,gt=0,strict=True)
    league_name: Optional[str] = Field(default=None,min_length=1,max_length=100)
    video_id: Optional[int] = Field(default=None, gt=0, strict=True)
    players: Optional[list[MatchPlayerRecord]] = Field(default=None, max_length=500)
    match_date: date                  # 경기 날짜 (필수)
    opponent: str                     # 상대팀 (필수)
    our_score: int = Field(ge=0)      # 우리팀 점수 (0 이상)
    opponent_score: int = Field(ge=0) # 상대팀 점수 (0 이상)
    location: Optional[str] = None    # 경기 장소 (선택)
    memo: Optional[str] = None        # 메모 (선택)

    @field_validator('league_name',mode='before')
    @classmethod
    def clean_league_name(cls,value):
        return value.strip() if isinstance(value,str) else value

    @model_validator(mode='after')
    def one_league_selection(self):
        if self.league_id is not None and self.league_name is not None:
            raise ValueError('리그 선택과 직접 추가 중 하나만 사용해 주세요.')
        return self


class MatchUpdate(MatchCreate):
    expected_league_id: Optional[int] = Field(default=None,gt=0,strict=True)


@app.get("/api/matches/{match_id}/players")
def get_match_player_records(match_id: int):
    connection = None
    try:
        connection = get_db_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT match_id FROM futsal_match WHERE match_id=%s", (match_id,))
            if cursor.fetchone() is None:
                raise HTTPException(404, "경기 기록을 찾을 수 없습니다.")
            records = read_match_players(cursor, match_id)
        return {"success": True, "data": records}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(500, "선수 경기 기록을 불러오지 못했습니다.") from None
    finally:
        if connection:
            connection.close()


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

            from src.services.club_leagues import new_match_league
            selected_league_id = new_match_league(cursor,match.league_id,match.league_name)
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
                    memo,
                    league_id
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """

            cursor.execute(sql, (
                1,
                match.match_date,
                match.opponent,
                match.our_score,
                match.opponent_score,
                match.location,
                result,
                match.memo,
                selected_league_id
            ))

            new_match_id = cursor.lastrowid
            save_match_players(cursor, new_match_id, match.players)
            from src.api.video_match_link import attach_video_to_new_match
            attach_video_to_new_match(cursor, new_match_id, match.video_id)

        connection.commit()

        return {
            "success": True,
            "message": "경기 기록이 등록되었습니다.",
            "data": {
                "match_id": new_match_id,
                "league_id": selected_league_id,
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
        if connection:
            connection.rollback()
        raise

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
def update_match(match_id: int, match: MatchUpdate):

    league_change='league_id' in match.model_fields_set
    expected_supplied='expected_league_id' in match.model_fields_set
    if 'league_name' in match.model_fields_set or league_change!=expected_supplied:
        raise HTTPException(422,'리그 선택과 기존 리그 정보를 확인해 주세요.')

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

            cursor.execute("SELECT match_id FROM futsal_match WHERE match_id=%s AND user_id=%s FOR UPDATE", (match_id, 1))
            if cursor.fetchone() is None:
                raise HTTPException(404, "수정할 경기 기록이 없습니다.")

            if league_change:
                from src.services.club_leagues import change_match_league
                change_match_league(cursor,match_id,match.league_id,match.expected_league_id)

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

            if match.players is not None:
                # Unchanged selections preserve the existing participation row IDs too.
                incoming=sorted((record.model_dump() for record in match.players),key=lambda row:row['player_id'])
                if incoming!=read_match_players(cursor,match_id):
                    save_match_players(cursor, match_id, match.players)

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
        if connection:
            connection.rollback()
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
APP_ROOT = PROJECT_ROOT
# Vercel filesystem is read-only outside /tmp. Current UI stores YouTube links in PostgreSQL.
VIDEO_DIR = Path("/tmp/wgh/uploads/videos") if os.getenv("VERCEL")=="1" else APP_ROOT / "uploads/videos"
STATIC_DIR = APP_ROOT / ("wgh_web" if os.getenv("VERCEL")=="1" else "public")
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


# 신규 유튜브 영상 API: 기존 영상/경기 API는 유지
from src.api.youtube_videos import router as youtube_video_router
app.include_router(youtube_video_router)
from src.api.tv import router as tv_router
app.include_router(tv_router)
from src.api.video_access import router as video_access_router
app.include_router(video_access_router)

from src.api.article_routes import create_article_router
app.include_router(create_article_router(get_db_connection))

from src.api.youtube_feedback import router as youtube_feedback_router
app.include_router(youtube_feedback_router)
from src.api.youtube_feedback import history_router as video_analysis_history_router
app.include_router(video_analysis_history_router)

from src.api.match_detail_routes import create_match_detail_router
app.include_router(create_match_detail_router(get_db_connection))

from src.api.player_detail_routes import create_player_detail_router
app.include_router(create_player_detail_router(get_db_connection))

from src.api.video_match_link import router as video_match_link_router
app.include_router(video_match_link_router)

from src.api.account_routes import router as account_router
app.include_router(account_router)
app.include_router(auth_router)

from src.api.player_management import create_player_management_router
app.include_router(create_player_management_router(get_db_connection))

from src.api.club_routes import create_club_router
app.include_router(create_club_router(get_db_connection))

class RevalidatingStaticFiles(StaticFiles):
    """Revalidate page assets so navigation changes do not leave old menus cached."""
    async def get_response(self, path, scope):
        from src.auth.auth import current_user, video_login_page, video_allowed, video_approval_page
        if Path(path).name.lower()=='feedback.html':
            analysis_id=Request(scope).query_params.get('analysis_id','')
            destination='/feedback-review.html?analysis_id='+analysis_id if analysis_id.isdigit() else '/video-register.html#analysisRunTitle'
            return RedirectResponse(destination,status_code=307,headers={'Cache-Control':'no-store'})
        admin_video_page=Path(path).name.lower() in ('video-register.html','feedback-review.html')
        if admin_video_page:
            try:
                user=current_user(Request(scope))
                if not user:
                    return HTMLResponse(video_login_page(),status_code=401,headers={'Cache-Control':'no-store'})
                if user.get('consent_required',False) or user.get('role')!='admin':
                    return HTMLResponse('<!doctype html><html lang="ko"><meta charset="utf-8"><title>관리자 전용</title><h1>관리자만 접근할 수 있습니다.</h1><a href="/video.html">경기 영상으로 돌아가기</a></html>',status_code=403,headers={'Cache-Control':'no-store'})
            except HTTPException:
                return HTMLResponse(video_login_page(),status_code=503,headers={'Cache-Control':'no-store'})
        video_page=Path(path).name.lower() in ('video.html','video_backup.html','feedback.html')
        if video_page:
            try:
                user=current_user(Request(scope))
                if not user or user.get('consent_required',False):
                    return HTMLResponse(video_login_page(),headers={'Cache-Control':'no-store'})
                if not video_allowed(user):
                    return HTMLResponse(video_approval_page(),status_code=403,headers={'Cache-Control':'no-store'})
            except HTTPException:
                return HTMLResponse(video_login_page(),status_code=503,headers={'Cache-Control':'no-store'})
        response = await super().get_response(path, scope)
        if admin_video_page or video_page or Path(path).name.lower()=='account.html':
            response.headers['Cache-Control']='no-store'
            return response
        if path in ("", ".") or path.lower().endswith((".html", ".js", ".css")):
            response.headers["Cache-Control"] = "no-cache, max-age=0, must-revalidate"
        return response


@app.api_route('/_wgh_pages/{page_name}',methods=['GET','HEAD'],include_in_schema=False)
async def protected_web_page(page_name: str,request: Request):
    if page_name not in ('video.html','video-register.html','feedback-review.html','feedback.html','video_backup.html'):
        raise HTTPException(404,'페이지를 찾을 수 없습니다.')
    # The build keeps the real templates outside Vercel's public CDN directory.
    files=RevalidatingStaticFiles(directory=str(STATIC_DIR),html=True)
    return await files.get_response(page_name,request.scope)


app.mount(
    "/",
    RevalidatingStaticFiles(directory=str(STATIC_DIR), html=True),
    name="static"
)


@app.middleware('http')
async def private_api_cache(request: Request, call_next):
    response=await call_next(request)
    if request.url.path.startswith('/api/'):
        response.headers['Cache-Control']='no-store'
    return response

