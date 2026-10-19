"""Player metadata management. Never remove recorded match stats or memberships."""
from datetime import date
from typing import Literal
import pymysql
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ConfigDict, field_validator
from auth import require_admin_for_request

class PlayerUpdate(BaseModel):
    model_config=ConfigDict(extra='forbid')
    player_name:str=Field(min_length=1,max_length=50)
    back_number:int=Field(ge=0,le=2147483647,strict=True)
    position:Literal['GK','FIXO','ALA','PIVO']
    joined_at:date|None=None

    @field_validator('player_name')
    @classmethod
    def clean_name(cls,value):
        value=value.strip()
        if not value:raise ValueError('선수 이름을 입력해 주세요.')
        return value

def create_player_management_router(connect):
    router=APIRouter(dependencies=[Depends(require_admin_for_request)])

    def manage(player_id,body=None):
        if player_id<=0:raise HTTPException(422,'선수 번호를 확인해 주세요.')
        db=None
        try:
            db=connect()
            with db.cursor() as cur:
                cur.execute('SELECT player_id FROM futsal_player WHERE player_id=%s FOR UPDATE',(player_id,))
                if cur.fetchone() is None:raise HTTPException(404,'선수를 찾을 수 없습니다.')
                if body is not None:
                    cur.execute('UPDATE futsal_player SET player_name=%s,back_number=%s,position=%s,joined_at=%s WHERE player_id=%s',(body.player_name,body.back_number,body.position,body.joined_at,player_id))
                else:
                    cur.execute('SELECT match_player_id FROM match_player WHERE player_id=%s LIMIT 1',(player_id,))
                    if cur.fetchone() is not None:raise HTTPException(409,'출전 기록이 있는 선수는 삭제할 수 없습니다. 기존 경기 기록은 유지됩니다.')
                    cur.execute('SELECT user_id FROM wgh_player_account WHERE player_id=%s LIMIT 1',(player_id,))
                    if cur.fetchone() is not None:raise HTTPException(409,'회원 연결이 있는 선수입니다. 선수 상세에서 회원 연결을 먼저 해제해 주세요.')
                    cur.execute('DELETE FROM futsal_player WHERE player_id=%s',(player_id,))
            db.commit()
            return {'success':True,'data':{'player_id':player_id,**(body.model_dump() if body else {})}}
        except HTTPException:
            if db:db.rollback()
            raise
        except pymysql.err.IntegrityError as error:
            if db:db.rollback()
            if error.args and error.args[0]==1062:raise HTTPException(409,'이미 사용 중인 등번호입니다.') from None
            raise HTTPException(409,'연결된 기록이 있어 삭제 또는 변경할 수 없습니다. 기존 기록은 유지됩니다.') from None
        except Exception:
            if db:db.rollback()
            raise HTTPException(503,'선수 정보를 저장하지 못했습니다. 잠시 후 다시 확인해 주세요.') from None
        finally:
            if db:db.close()

    @router.put('/api/players/{player_id}')
    def update(player_id:int,body:PlayerUpdate):return manage(player_id,body)

    @router.delete('/api/players/{player_id}')
    def delete(player_id:int):return manage(player_id)

    return router
