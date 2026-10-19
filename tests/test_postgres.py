import ast
import os
from pathlib import Path
import re
import unittest
from unittest.mock import MagicMock, patch
import database
import postgres_migrate as migrate


class PostgresSQLTests(unittest.TestCase):
    def test_known_functions_and_bound_values(self):
        sql=database.postgres_sql("SELECT DATE_FORMAT(a.match_date,'%%Y-%%m-%%d'),TIME_FORMAT(start_time,'%%H:%%i'),DATABASE() FROM futsal_match a WHERE match_date>=CURDATE() AND memo=%s")
        self.assertIn("to_char(a.match_date, 'YYYY-MM-DD')",sql)
        self.assertIn("to_char((DATE '2000-01-01' + start_time), 'HH24:MI')",sql)
        self.assertIn('current_database()',sql)
        self.assertIn('memo=%s',sql)

    def test_native_postgres_database_name_is_not_rewritten(self):
        query='SELECT current_database() db_name,current_schema() schema_name'
        self.assertEqual(database.postgres_sql(query),query)

    def test_oauth_expiration_uses_utc_and_bound_ttl(self):
        sql=database.postgres_sql('SELECT DATE_ADD(UTC_TIMESTAMP(), INTERVAL %s SECOND),DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE)')
        self.assertIn("AT TIME ZONE 'UTC'",sql)
        self.assertIn("%s * INTERVAL '1 second'",sql)
        self.assertIn("INTERVAL '10 minutes'",sql)

    def test_upsert_consent_and_email_rules(self):
        self.assertIn('ON CONFLICT (user_id) DO NOTHING',database.postgres_sql('INSERT IGNORE INTO wgh_account_consent(user_id) VALUES(%s)'))
        self.assertIn("ON CONFLICT (user_id) DO UPDATE SET role='admin'",database.postgres_sql("INSERT INTO wgh_user_role(user_id,role) VALUES(%s,'admin') ON DUPLICATE KEY UPDATE role='admin'"))
        self.assertIn('lower(email)=lower(%s)',database.postgres_sql('SELECT user_id FROM app_user WHERE email=%s'))

    def test_identity_returning_and_bulk_does_not_interpolate(self):
        raw=MagicMock();raw.cursor.return_value.fetchone.return_value={'video_id':9}
        cur=database.PostgresCursor(database.PostgresConnection(raw))
        values=("A'; DROP TABLE app_user; --",)
        cur.execute('INSERT INTO futsal_video(title) VALUES(%s)',values)
        self.assertEqual(cur.lastrowid,9)
        self.assertEqual(raw.cursor.return_value.execute.call_args.args,('INSERT INTO futsal_video(title) VALUES(%s) RETURNING video_id',values))

    def test_exception_mapping(self):
        error=MagicMock();error.sqlstate='23505';error.diag.constraint_name='uq_wgh_player_account_user'
        mapped=database._mapped(error)
        self.assertEqual(mapped.args,(1062,'uq_wgh_player_account_user'))

    def test_postgres_write_gate_defaults_closed(self):
        from fastapi import HTTPException
        with patch.dict(os.environ,{'WGH_ALLOW_ANALYSIS_WRITES':''}):
            with self.assertRaises(HTTPException):database.assert_postgres_writes(MagicMock(),'analysis')
        with patch.dict(os.environ,{'DB_ENGINE':'unknown'}):
            with self.assertRaises(ValueError):database.engine()

    def test_existing_static_sql_parses_as_postgres(self):
        try:from pglast import parse_sql
        except ImportError:self.skipTest('Optional pglast parser not installed')
        root=Path(database.__file__).parent;checked=0
        for path in root.glob('*.py'):
            if path.name in ('main_backup.py','database.py','postgres_migrate.py'):continue
            for node in ast.walk(ast.parse(path.read_text(encoding='utf-8-sig'))):
                if not isinstance(node,ast.Call) or not isinstance(node.func,ast.Attribute) or node.func.attr not in ('execute','executemany') or not node.args:continue
                statement=node.args[0]
                if not isinstance(statement,ast.Constant) or not isinstance(statement.value,str):continue
                value=statement.value.strip()
                if not re.match(r'^(SELECT|INSERT|UPDATE|DELETE)\b',value,re.I):continue
                transformed=database.postgres_sql(value)
                params=iter(range(1,1000));transformed=re.sub('%s',lambda _:'$'+str(next(params)),transformed)
                parse_sql(transformed);checked+=1
        self.assertGreater(checked,60)


class MigrationSafetyTests(unittest.TestCase):
    def test_new_schema_required_before_opening_target(self):
        with patch.object(migrate,'target_connection') as target:
            with self.assertRaises(ValueError):migrate.apply('not-opened','SECRET',False)
            target.assert_not_called()

    def test_existing_schema_rejected_without_creating_tables(self):
        connection=MagicMock();connection.__enter__.return_value=connection
        cur=connection.cursor.return_value.__enter__.return_value;cur.fetchone.return_value={'existing':'wgh'}
        with patch.object(migrate,'read_bundle',return_value=({}, {}, 'CREATE TABLE should_not_run();')),patch.object(migrate,'target_connection',return_value=connection):
            with self.assertRaises(ValueError):migrate.apply('bundle','SECRET',True)
        self.assertEqual(cur.execute.call_count,1)

    def test_identifier_and_time_safety(self):
        from datetime import timedelta
        with self.assertRaises(ValueError):migrate.identifier('wgh; DROP SCHEMA public')
        self.assertEqual(migrate.encode(timedelta(hours=20,minutes=30)),'20:30:00')
        with self.assertRaises(ValueError):migrate.encode(timedelta(hours=25))


if __name__=='__main__':unittest.main()
