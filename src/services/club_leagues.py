"""Club metadata only. These helpers never save players, scores or videos."""
from fastapi import HTTPException


def active_league(cursor, league_id):
    if league_id is None:
        return None
    cursor.execute('SELECT league_id,name,is_active FROM league WHERE league_id=%s FOR SHARE', (league_id,))
    league = cursor.fetchone()
    if league is None:
        raise HTTPException(404, '선택한 리그를 찾을 수 없습니다.')
    if not league['is_active']:
        raise HTTPException(409, '사용 중지된 리그입니다. 다른 리그를 선택해 주세요.')
    return league


def create_or_find_league(cursor, name):
    # One normalized unique key handles concurrent administrators adding the same name.
    cursor.execute('''INSERT INTO league(name) VALUES (%s)
        ON CONFLICT (lower(name)) DO NOTHING RETURNING league_id''', (name,))
    inserted = cursor.fetchone()
    cursor.execute('SELECT league_id,name,is_active FROM league WHERE lower(name)=lower(%s) FOR SHARE', (name,))
    league = cursor.fetchone()
    if league is None or not league['is_active']:
        raise HTTPException(409, '사용 중지된 리그와 이름이 같습니다. 다른 이름을 사용해 주세요.')
    return league, inserted is not None


def new_match_league(cursor, league_id, league_name):
    if league_name is not None:
        return create_or_find_league(cursor, league_name)[0]['league_id']
    if league_id is not None:
        return active_league(cursor, league_id)['league_id']
    return None


def change_match_league(cursor, match_id, league_id, expected_league_id):
    """Caller owns the transaction. Only league_id may be written here."""
    cursor.execute('SELECT match_id,league_id FROM futsal_match WHERE match_id=%s AND user_id=%s FOR UPDATE',(match_id,1))
    row=cursor.fetchone()
    if row is None:
        raise HTTPException(404,'경기 기록을 찾을 수 없습니다.')
    if row['league_id']!=expected_league_id:
        raise HTTPException(409,'다른 창에서 리그가 변경되었습니다. 수정창을 다시 열어 주세요.')
    league=active_league(cursor,league_id)
    if row['league_id']!=league_id:
        cursor.execute('UPDATE futsal_match SET league_id=%s WHERE match_id=%s AND user_id=%s',(league_id,match_id,1))
    return {'match_id':match_id,'league_id':league_id,'league_name':league['name'] if league else None}
