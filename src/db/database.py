"""Database boundary for the existing WGH repositories.

MySQL remains available for rollback. PostgreSQL uses psycopg, dictionary rows,
and a small, tested translation of the application's existing static SQL.
Bound values are never interpolated or rewritten. This isn't a general SQL converter.
"""
import os
import re
import pymysql

IDENTITIES = {'app_user':'user_id','futsal_match':'match_id',
              'futsal_player':'player_id','futsal_schedule':'schedule_id',
              'futsal_video':'video_id','match_player':'match_player_id',
              'player':'player_id','video_analysis':'analysis_id','video_event':'event_id',
              'wgh_admin_request':'request_id','wgh_role_history':'history_id'}


def engine():
    value=os.getenv('DB_ENGINE','mysql').lower()
    if value not in ('mysql','postgres','postgresql'):
        raise ValueError('DB_ENGINE must be mysql or postgres')
    return 'postgres' if value!='mysql' else value


def postgres_sql(statement):
    """Translate only the constructs currently used in WGH's static queries."""
    statement=re.sub(r'DATE_ADD\(UTC_TIMESTAMP\(\),\s*INTERVAL\s+10\s+MINUTE\)',
                     "((CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '10 minutes')",statement,flags=re.I)
    statement=re.sub(r'DATE_ADD\(UTC_TIMESTAMP\(\),\s*INTERVAL\s+%s\s+SECOND\)',
                     "((CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + (%s * INTERVAL '1 second'))",statement,flags=re.I)
    statement=re.sub(r'UTC_TIMESTAMP\(\)',"(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')",statement,flags=re.I)
    statement=re.sub(r'CURDATE\(\)',"(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date",statement,flags=re.I)
    statement=re.sub(r'\bDATABASE\(\)','current_database()',statement,flags=re.I)
    formats={'%Y-%m-%d':'YYYY-MM-DD','%Y-%m-%d %H:%i':'YYYY-MM-DD HH24:MI',
             '%Y-%m-%d %H:%i:%s':'YYYY-MM-DD HH24:MI:SS','%H:%i':'HH24:MI'}
    def formatted(match):
        fmt=match[2].replace('%%','%')
        if fmt not in formats:raise ValueError('Unsupported database date format')
        expression=match[1]
        if match[0].upper().startswith('TIME_FORMAT'):
            expression=f"(DATE '2000-01-01' + {expression})"
        return f"to_char({expression}, '{formats[fmt]}')"
    statement=re.sub(r"(?:DATE_FORMAT|TIME_FORMAT)\(\s*([\w.]+)\s*,\s*'([^']+)'\s*\)",formatted,statement,flags=re.I)
    statement=re.sub(r'GET_LOCK\(%s,\s*0\)',
                     'pg_try_advisory_lock(hashtextextended(%s,0))',statement,flags=re.I)
    statement=re.sub(r'RELEASE_LOCK\(%s\)',
                     'pg_advisory_unlock(hashtextextended(%s,0))',statement,flags=re.I)
    statement=re.sub(r"ON DUPLICATE KEY UPDATE role='admin'",
                     "ON CONFLICT (user_id) DO UPDATE SET role='admin'",statement,flags=re.I)
    if re.match(r'\s*INSERT IGNORE INTO wgh_account_consent\b',statement,re.I):
        statement=re.sub('INSERT IGNORE','INSERT',statement,count=1,flags=re.I)
        statement+=' ON CONFLICT (user_id) DO NOTHING'
    # Preserve MySQL's case-insensitive email account-collision check.
    statement=re.sub(r'WHERE email=%s',r'WHERE lower(email)=lower(%s)',statement,flags=re.I)
    return statement


def _mapped(error):
    """Keep existing API conflict handling and never expose credentials to callers."""
    code=getattr(error,'sqlstate',None)
    constraint=getattr(getattr(error,'diag',None),'constraint_name',None) or ''
    if code=='23505':return pymysql.err.IntegrityError(1062,constraint)
    if code and code.startswith('23'):return pymysql.err.IntegrityError(1451,'PostgreSQL integrity constraint')
    return pymysql.err.OperationalError(2000,'PostgreSQL operation failed')


class PostgresCursor:
    def __init__(self,connection):
        self.raw=connection.raw.cursor()
        self.lastrowid=None

    def __enter__(self):return self
    def __exit__(self,*args):self.raw.close()
    @property
    def rowcount(self):return self.raw.rowcount

    def execute(self,statement,params=None):
        self.lastrowid=None
        translated=postgres_sql(statement)
        match=re.match(r'\s*INSERT\s+INTO\s+([a-z_]+)\s*\(',translated,re.I)
        identity=IDENTITIES.get(match[1].lower()) if match else None
        if identity and not re.search(r'\bRETURNING\b',translated,re.I):
            translated=translated.rstrip().rstrip(';')+' RETURNING '+identity
        try:
            self.raw.execute(translated,params)
            if identity:
                row=self.raw.fetchone()
                self.lastrowid=row[identity] if row else None
            return self.raw.rowcount
        except Exception as error:
            import psycopg
            if isinstance(error,psycopg.Error):raise _mapped(error) from None
            raise

    def executemany(self,statement,rows):
        # The existing caller doesn't consume returned ids for bulk player records.
        for row in rows:self.execute(statement,row)

    def fetchone(self):return self.raw.fetchone()
    def fetchall(self):return self.raw.fetchall()


class PostgresConnection:
    backend='postgres'
    def __init__(self,raw):self.raw=raw
    def cursor(self):return PostgresCursor(self)
    def commit(self):
        try:self.raw.commit()
        except Exception as error:raise _mapped(error) from None
    def rollback(self):self.raw.rollback()
    def close(self):self.raw.close()


def connect():
    if engine()=='mysql':
        return pymysql.connect(host=os.getenv('DB_HOST','localhost'),user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),database=os.getenv('DB_NAME','futsaldb'),
            port=int(os.getenv('DB_PORT','3306')),charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor,autocommit=False)
    import psycopg
    from psycopg.rows import dict_row
    url=os.getenv('DATABASE_URL','')
    if not url:raise ValueError('DATABASE_URL is required for PostgreSQL')
    try:
        # Session pooling or direct connection is required for analysis advisory locks.
        raw=psycopg.connect(url,connect_timeout=15,row_factory=dict_row,prepare_threshold=None,sslmode=os.getenv('PG_SSLMODE','require'))
        raw.execute("SET TIME ZONE 'Asia/Seoul'")
        raw.execute('SET search_path TO wgh, pg_catalog')
        raw.commit()
        return PostgresConnection(raw)
    except psycopg.Error:
        raise pymysql.err.OperationalError(2000,'PostgreSQL connection failed') from None


def is_postgres(connection):
    return getattr(connection,'backend',None)=='postgres'


def assert_postgres_writes(connection,purpose):
    from fastapi import HTTPException
    setting={'analysis':'WGH_ALLOW_ANALYSIS_WRITES','sync':'WGH_ALLOW_SYNC_WRITES'}[purpose]
    if os.getenv(setting,'').lower()!='true':
        raise HTTPException(503,f'PostgreSQL {purpose} writes are disabled. Set {setting}=true after migration verification.')
    with connection.cursor() as cur:
        cur.execute("SELECT current_database() db_name, current_schema() schema_name, to_regclass('wgh.futsal_video') AS videos")
        row=cur.fetchone()
        if not row or row['db_name']!=os.getenv('POSTGRES_EXPECTED_DATABASE','postgres') or row['schema_name']!='wgh' or row['videos'] is None:
            raise HTTPException(503,'PostgreSQL target database/schema does not match the reviewed configuration.')
