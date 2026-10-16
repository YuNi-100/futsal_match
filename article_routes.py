"""로컬 교육용 API. 공개 서비스에는 사용자 인증과 호출 제한을 추가해야 한다."""
from typing import Literal
from fastapi import APIRouter, HTTPException, Path
from pydantic import BaseModel, ConfigDict
from article_generation import ArticleError, build_facts, generate_article

class ArticleRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mode: Literal["template", "openai"] = "template"

def create_article_router(get_db_connection):
    router = APIRouter()

    @router.post("/api/matches/{match_id}/article")
    def create_article(body: ArticleRequest, match_id: int = Path(gt=0)):
        connection = None
        try:
            connection = get_db_connection()
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT match_date, opponent, our_score, opponent_score, location
                    FROM futsal_match
                    WHERE match_id = %s AND user_id = %s
                    """,
                    (match_id, 1),
                )
                match = cursor.fetchone()
        except Exception:
            raise HTTPException(500, "기사용 경기 기록을 조회하지 못했습니다.") from None
        finally:
            if connection:
                connection.close()
        if match is None:
            raise HTTPException(404, "경기 기록을 찾을 수 없습니다.")
        try:
            facts = build_facts(match)
        except (ValueError, KeyError, TypeError):
            raise HTTPException(422, "날짜·상대팀·점수·장소 등 등록된 경기 정보를 확인해 주세요.") from None
        try:
            result = generate_article(facts, body.mode)
        except ArticleError as error:
            raise HTTPException(error.status_code, str(error)) from None
        return {"success": True, "data": result}

    return router

