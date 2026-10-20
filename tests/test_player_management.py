import sys,unittest

from unittest.mock import MagicMock,patch
from fastapi import FastAPI,Depends
from fastapi.testclient import TestClient
import pymysql
from src.auth import auth
from src.api.player_management import create_player_management_router
class Tests(unittest.TestCase):
 def setUp(self):
  self.db=MagicMock();self.cur=self.db.cursor.return_value.__enter__.return_value
  app=FastAPI();app.include_router(create_player_management_router(lambda:self.db));self.client=TestClient(app)
  self.identity=patch.object(auth,'current_user',return_value={'user_id':1,'role':'admin','csrf_token':'token'});self.identity.start();self.addCleanup(self.identity.stop)
  self.headers={'X-CSRF-Token':'token'};self.body={'player_name':'새 이름','back_number':23,'position':'PIVO','joined_at':'2026-10-19'}
 def test_update_metadata_only(self):
  self.cur.fetchone.return_value={'player_id':1};res=self.client.put('/api/players/1',json=self.body,headers=self.headers);self.assertEqual(res.status_code,200);self.db.commit.assert_called_once();queries=' '.join(c.args[0] for c in self.cur.execute.call_args_list);self.assertNotIn('UPDATE match_player',queries);self.assertNotIn('DELETE',queries)
 def test_history_blocks_delete(self):
  self.cur.fetchone.side_effect=[{'player_id':1},{'match_player_id':9}];self.assertEqual(self.client.delete('/api/players/1',headers=self.headers).status_code,409);self.db.commit.assert_not_called();self.assertFalse(any('DELETE' in c.args[0] for c in self.cur.execute.call_args_list))
 def test_membership_blocks_delete(self):
  self.cur.fetchone.side_effect=[{'player_id':1},None,{'user_id':1}];self.assertEqual(self.client.delete('/api/players/1',headers=self.headers).status_code,409);self.db.commit.assert_not_called()
 def test_unlinked_delete(self):
  self.cur.fetchone.side_effect=[{'player_id':1},None,None];self.assertEqual(self.client.delete('/api/players/1',headers=self.headers).status_code,200);self.db.commit.assert_called_once()
 def test_duplicate_number(self):
  self.cur.fetchone.return_value={'player_id':1};self.cur.execute.side_effect=[None,pymysql.err.IntegrityError(1062,'duplicate')];self.assertEqual(self.client.put('/api/players/1',json=self.body,headers=self.headers).status_code,409);self.db.rollback.assert_called_once()
 def test_access_and_csrf(self):
  for identity,headers,code in [(None,self.headers,401),({'role':'user','csrf_token':'token'},self.headers,403),({'role':'admin','csrf_token':'token'},{},403)]:
   with patch.object(auth,'current_user',return_value=identity):
    self.assertEqual(self.client.put('/api/players/1',json=self.body,headers=headers).status_code,code);self.assertEqual(self.client.delete('/api/players/1',headers=headers).status_code,code)
  self.cur.execute.assert_not_called()
 def test_missing_and_invalid(self):
  self.cur.fetchone.return_value=None;self.assertEqual(self.client.put('/api/players/1',json=self.body,headers=self.headers).status_code,404);self.assertEqual(self.client.put('/api/players/1',json={**self.body,'member_user_id':1},headers=self.headers).status_code,422)
if __name__=='__main__': unittest.main()
