"""WGH YouTube video database access layer (MySQL / PostgreSQL)."""
import os
import pymysql
from pymysql.cursors import DictCursor


from src.db.database import connect


def find_match(connection, match_id, user_id):
    with connection.cursor() as cursor:
        cursor.execute(
            'SELECT match_id FROM futsal_match WHERE match_id = %s AND user_id = %s',
            (match_id, user_id),
        )
        return cursor.fetchone()


def find_youtube_id(connection, youtube_id):
    with connection.cursor() as cursor:
        cursor.execute('SELECT video_id FROM futsal_video WHERE youtube_id = %s', (youtube_id,))
        return cursor.fetchone()


def create_video(connection, *, user_id, match_id, title, youtube_id, match_date):
    with connection.cursor() as cursor:
        cursor.execute(
            '''INSERT INTO futsal_video (user_id, match_id, title, youtube_id, match_date)
               VALUES (%s, %s, %s, %s, %s)''',
            (user_id, match_id, title, youtube_id, match_date),
        )
        video_id = cursor.lastrowid
        cursor.execute(
            '''SELECT video_id, user_id, match_id, title, youtube_id,
                      DATE_FORMAT(match_date, '%%Y-%%m-%%d') AS match_date,
                      DATE_FORMAT(created_at, '%%Y-%%m-%%d %%H:%%i:%%s') AS created_at
               FROM futsal_video WHERE video_id = %s''',
            (video_id,),
        )
        return cursor.fetchone()


def list_videos(connection, user_id):
    with connection.cursor() as cursor:
        cursor.execute(
            '''SELECT video_id, user_id, match_id, title, youtube_id,
                      DATE_FORMAT(match_date, '%%Y-%%m-%%d') AS match_date,
                      DATE_FORMAT(created_at, '%%Y-%%m-%%d %%H:%%i:%%s') AS created_at
               FROM futsal_video
               WHERE user_id = %s
               ORDER BY match_date DESC, video_id DESC''',
            (user_id,),
        )
        return cursor.fetchall()
