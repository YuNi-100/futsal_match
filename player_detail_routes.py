"""Read-only player profile and per-match records, from existing tables."""
from fastapi import APIRouter, HTTPException, Path


def create_player_detail_router(get_db_connection):
    router = APIRouter()

    @router.get('/api/players/{player_id}')
    def get_player_detail(player_id: int = Path(gt=0)):
        connection = None
        try:
            connection = get_db_connection()
            with connection.cursor() as cursor:
                cursor.execute('''SELECT player_id,player_name,back_number,position,
                    DATE_FORMAT(joined_at,'%%Y-%%m-%%d') AS joined_at
                    FROM futsal_player WHERE player_id=%s''',(player_id,))
                player = cursor.fetchone()
                if player is None:
                    raise HTTPException(404,'선수 정보를 찾을 수 없습니다.')
                cursor.execute('''SELECT COUNT(*) AS appearances,
                    COALESCE(SUM(goals),0) AS goals,COALESCE(SUM(assists),0) AS assists
                    FROM match_player WHERE player_id=%s''',(player_id,))
                player.update({key:int(value) for key,value in cursor.fetchone().items()})
                cursor.execute('''SELECT m.match_id,
                    DATE_FORMAT(m.match_date,'%%Y-%%m-%%d') AS match_date,
                    m.opponent,m.our_score,m.opponent_score,m.result,
                    mp.goals,mp.assists,
                    EXISTS(SELECT 1 FROM futsal_video v WHERE v.match_id=m.match_id AND v.user_id=1) AS has_video
                    FROM match_player mp JOIN futsal_match m ON m.match_id=mp.match_id
                    WHERE mp.player_id=%s ORDER BY m.match_date DESC,m.match_id DESC''',(player_id,))
                player['matches'] = list(cursor.fetchall())
            return {'success':True,'data':player}
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(500,'선수 정보를 불러오지 못했습니다.') from None
        finally:
            if connection:
                connection.close()

    return router
