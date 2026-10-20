"""Existing match_player table access; caller controls transaction and authorization."""
from fastapi import HTTPException
from pydantic import BaseModel, Field


class MatchPlayerRecord(BaseModel):
    player_id: int = Field(gt=0, strict=True)
    goals: int = Field(default=0, ge=0, strict=True)
    assists: int = Field(default=0, ge=0, strict=True)


def save_match_players(cursor, match_id, players):
    # Omitted field preserves records for older API clients. Explicit [] clears selection.
    if players is None:
        return
    ids = [record.player_id for record in players]
    if len(ids) != len(set(ids)):
        raise HTTPException(422, '같은 선수를 중복 선택할 수 없습니다.')
    if ids:
        placeholders = ','.join(['%s'] * len(ids))
        cursor.execute(f'SELECT player_id FROM futsal_player WHERE player_id IN ({placeholders}) FOR UPDATE', tuple(ids))
        if {row['player_id'] for row in cursor.fetchall()} != set(ids):
            raise HTTPException(422, '존재하지 않는 선수가 포함되어 있습니다. 다시 불러와 주세요.')
    cursor.execute('DELETE FROM match_player WHERE match_id=%s', (match_id,))
    if players:
        cursor.executemany('INSERT INTO match_player (match_id,player_id,goals,assists) VALUES (%s,%s,%s,%s)',
                           [(match_id, row.player_id, row.goals, row.assists) for row in players])


def read_match_players(cursor, match_id):
    cursor.execute('SELECT player_id,goals,assists FROM match_player WHERE match_id=%s ORDER BY player_id', (match_id,))
    return list(cursor.fetchall())
