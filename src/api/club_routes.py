"""Dedicated metadata APIs; match league updates only write league_id."""
from fastapi import APIRouter, HTTPException, Path
from pydantic import BaseModel, ConfigDict, Field, field_validator
from src.services.club_leagues import change_match_league, create_or_find_league


class LeagueName(BaseModel):
    model_config = ConfigDict(extra='forbid')
    name: str = Field(min_length=1,max_length=100)

    @field_validator('name',mode='before')
    @classmethod
    def clean_name(cls,value):
        return value.strip() if isinstance(value,str) else value


class MatchLeagueChange(BaseModel):
    model_config = ConfigDict(extra='forbid')
    league_id: int | None = Field(...,gt=0,strict=True)
    expected_league_id: int | None = Field(...,gt=0,strict=True)


class TeamNameChange(BaseModel):
    model_config = ConfigDict(extra='forbid')
    team_name: str = Field(min_length=1,max_length=100)
    expected_revision: int = Field(gt=0,strict=True)

    @field_validator('team_name',mode='before')
    @classmethod
    def clean_name(cls,value):
        return value.strip() if isinstance(value,str) else value


def create_club_router(get_db_connection):
    router=APIRouter()

    # Always roll back on errors and never expose connection details.
    def execute(action,write=False):
        connection=None
        try:
            connection=get_db_connection()
            with connection.cursor() as cursor:
                data=action(cursor)
            if write:
                connection.commit()
            return {'success':True,'data':data}
        except HTTPException:
            if connection: connection.rollback()
            raise
        except Exception:
            if connection: connection.rollback()
            raise HTTPException(503,'팀·리그 정보를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.') from None
        finally:
            if connection: connection.close()

    @router.get('/api/club-settings')
    def get_settings():
        def read(cursor):
            cursor.execute('SELECT team_name,revision FROM club_settings WHERE settings_id=1')
            row=cursor.fetchone()
            if row is None: raise HTTPException(503,'팀 설정을 불러오지 못했습니다.')
            return row
        return execute(read)

    @router.put('/api/admin/club-settings')
    def update_settings(body: TeamNameChange):
        def update(cursor):
            cursor.execute('SELECT team_name,revision FROM club_settings WHERE settings_id=1 FOR UPDATE')
            row=cursor.fetchone()
            if row is None: raise HTTPException(503,'팀 설정을 불러오지 못했습니다.')
            if row['revision']!=body.expected_revision:
                raise HTTPException(409,'다른 창에서 팀명이 변경되었습니다. 창을 다시 열어 주세요.')
            if row['team_name']==body.team_name:
                return row
            cursor.execute('UPDATE club_settings SET team_name=%s,revision=revision+1 WHERE settings_id=1',(body.team_name,))
            return {'team_name':body.team_name,'revision':row['revision']+1}
        return execute(update,write=True)

    @router.get('/api/leagues')
    def get_leagues():
        def read(cursor):
            cursor.execute('SELECT league_id,name FROM league WHERE is_active=true ORDER BY lower(name),league_id')
            return list(cursor.fetchall())
        return execute(read)

    @router.post('/api/leagues')
    def add_league(body: LeagueName):
        def add(cursor):
            league,created=create_or_find_league(cursor,body.name)
            return {'league_id':league['league_id'],'name':league['name'],'created':created}
        return execute(add,write=True)

    @router.get('/api/admin/leagues')
    def get_managed_leagues():
        def read(cursor):
            cursor.execute('''SELECT l.league_id,l.name,l.is_active,count(m.match_id) AS match_count
                FROM league l LEFT JOIN futsal_match m ON m.league_id=l.league_id
                GROUP BY l.league_id,l.name,l.is_active ORDER BY lower(l.name),l.league_id''')
            return list(cursor.fetchall())
        return execute(read)

    @router.delete('/api/leagues/{league_id}')
    def delete_league(league_id: int=Path(gt=0)):
        def remove(cursor):
            # Assigning a league takes FOR SHARE on the same row. Holding this lock
            # prevents a new assignment between the usage check and deletion.
            cursor.execute('SELECT league_id FROM league WHERE league_id=%s FOR UPDATE',(league_id,))
            if cursor.fetchone() is None:
                raise HTTPException(404,'이미 삭제되었거나 존재하지 않는 리그입니다.')
            cursor.execute('SELECT count(*) AS match_count FROM futsal_match WHERE league_id=%s',(league_id,))
            if cursor.fetchone()['match_count']:
                raise HTTPException(409,'경기에 사용 중인 리그입니다. 경기 수정에서 다른 리그나 리그 미지정으로 변경한 뒤 삭제해 주세요.')
            cursor.execute('DELETE FROM league WHERE league_id=%s',(league_id,))
            return {'league_id':league_id}
        return execute(remove,write=True)

    @router.patch('/api/matches/{match_id}/league')
    def update_match_league(body: MatchLeagueChange,match_id: int=Path(gt=0)):
        return execute(lambda cursor:change_match_league(cursor,match_id,body.league_id,body.expected_league_id),write=True)

    return router
