import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import MagicMock, patch
import pymysql
import youtube_sync as sync


def row(video_id='abcdefghijk', title='은평 2026-10-19 친선 경기'):
    match_date, reason = sync.classify_title(title)
    return dict(youtube_id=video_id, title=title, match_date=match_date, skip_reason=reason)


class TitleAndFeedTests(unittest.TestCase):
    def test_homepage_title_removes_only_extracted_date(self):
        for title, expected in [
            ('2026-03-30 은평vs다산2', '은평vs다산2'),
            ('WGH 2026-03-30 은평vs다산2', 'WGH 은평vs다산2'),
            ('은평vs다산2 2026-03-30', '은평vs다산2'),
            ('은평vs다산2', '은평vs다산2'),
            ('은평 2026-04-01 2차전', '은평 2026-04-01 2차전'),
        ]:
            self.assertEqual(sync.homepage_title(title, '2026-03-30'), expected)

    def test_keyword_or_and_case(self):
        for title in ['WGH 2026-10-19 상대팀', 'wgh 2026-10-19', '은평 2026-10-19', '은평 WGH 2026-10-19', '2026-10-19 친선경기']:
            self.assertEqual(sync.classify_title(title), ('2026-10-19', None))

    def test_ambiguous_invalid_missing_dates_and_unrelated_videos_skip(self):
        for title in ['공연 2026-10-19', 'WGH 2026-02-30', '은평 26.10.19', 'WGH 2026-10-19 2026-10-20', 'WGH 12026-10-19', 'WGH 0001-01-01', 'WGH 2026-10-19' + 'a' * 200]:
            self.assertIsNotNone(sync.classify_title(title)[1], title)
        self.assertEqual(sync.classify_title('WGH 2024-02-29')[0], '2024-02-29')

    def test_feed_is_channel_scoped_and_deduplicated(self):
        entry = f'<entry><yt:channelId>{sync.CHANNEL_ID}</yt:channelId><yt:videoId>abcdefghijk</yt:videoId><title>WGH 2026-10-19 &amp; 상대팀</title></entry>'
        data = f'<feed xmlns="{sync.NS["a"]}" xmlns:yt="{sync.NS["yt"]}"><yt:channelId>{sync.CHANNEL_ID}</yt:channelId>{entry}{entry}</feed>'
        parsed = sync.parse_feed(data)
        self.assertEqual(len(parsed), 1)
        self.assertEqual(parsed[0]['title'], 'WGH 2026-10-19 & 상대팀')
        self.assertEqual(sync.parse_feed(data.replace('>' + sync.CHANNEL_ID + '<', '>' + sync.CHANNEL_ID[2:] + '<', 1)), parsed)
        with self.assertRaises(ValueError):
            sync.parse_feed(data.replace(sync.CHANNEL_ID, 'UCother', 1))
        with self.assertRaises(ValueError):
            sync.parse_feed(data.replace('<entry><yt:channelId>' + sync.CHANNEL_ID, '<entry><yt:channelId>UCother', 1))
        with self.assertRaises(ValueError):
            sync.parse_feed(data.replace('abcdefghijk', 'invalid/id!'))

    def test_preview_never_opens_database_or_writes_state(self):
        with patch.object(sync, 'fetch_feed', return_value=[row()]), patch.object(sync.repository, 'connect') as connect, patch.object(sync, 'save_seen') as save, patch('builtins.print'):
            self.assertEqual(sync.main([]), 0)
            connect.assert_not_called()
            save.assert_not_called()

    def test_channel_fallback_reads_only_selected_tab_and_checks_channel(self):
        video = {'videoRenderer': {'videoId': 'abcdefghijk', 'title': {'runs': [{'text': '2026-10-19 친선경기'}]}}}
        data = {
            'metadata': {'channelMetadataRenderer': {'externalId': sync.CHANNEL_ID}},
            'contents': {'twoColumnBrowseResultsRenderer': {'tabs': [
                {'tabRenderer': {'selected': True, 'content': [video, video]}},
                {'tabRenderer': {'selected': False, 'content': [{'videoRenderer': {'videoId': '12345678901', 'title': {'runs': [{'text': 'WGH 2026-10-19'}]}}}]}},
            ]}},
        }
        page = 'var ytInitialData = ' + json.dumps(data) + ';</script>'
        self.assertEqual(sync.parse_channel_page(page), [row(title='2026-10-19 친선경기')])
        with self.assertRaises(ValueError):
            sync.parse_channel_page(page.replace(sync.CHANNEL_ID, 'UCother'))

    def test_rss_error_uses_channel_fallback_without_changing_filter(self):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'channel page'
        with patch.object(sync, 'fetch_rss_feed', side_effect=OSError('feed failed')), patch.object(sync, 'urlopen', return_value=response), patch.object(sync, 'parse_channel_page', return_value=[row()]) as parse:
            self.assertEqual(sync.fetch_feed(), [row()])
            parse.assert_called_once_with('channel page')


class ImportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.state = Path(self.temp.name) / 'state.json'
        self.db = MagicMock()
        self.cur = self.db.cursor.return_value.__enter__.return_value
        self.cur.fetchone.return_value = {'db_name': sync.TEST_DATABASE}
        for patcher in [patch.dict(os.environ, {'DB_NAME': sync.TEST_DATABASE}), patch.object(sync.repository, 'connect', return_value=self.db)]:
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_registers_only_matching_title_with_unlinked_match(self):
        with patch.object(sync.repository, 'find_youtube_id', return_value=None), patch.object(sync.repository, 'create_video') as create:
            result = sync.import_rows([row(), row('12345678901', '공연 2026-10-19')], self.state)
        self.assertEqual(result, dict(registered=1, already_registered=0, ignored=1))
        create.assert_called_once_with(self.db, user_id=1, match_id=None, title='은평 친선 경기', youtube_id='abcdefghijk', match_date='2026-10-19')
        self.db.commit.assert_called_once()
        self.assertEqual(sync.load_seen(self.state), {'abcdefghijk'})
        # A later homepage deletion must not make the worker reinsert the video.
        with patch.object(sync.repository, 'create_video') as create:
            self.assertEqual(sync.import_rows([row()], self.state)['ignored'], 1)
            create.assert_not_called()

    def test_existing_video_is_remembered_without_updating_any_fields(self):
        with patch.object(sync.repository, 'find_youtube_id', return_value={'video_id': 3}), patch.object(sync.repository, 'create_video') as create:
            result = sync.import_rows([row()], self.state)
        self.assertEqual(result['already_registered'], 1)
        create.assert_not_called()
        self.assertIn('abcdefghijk', sync.load_seen(self.state))

    def test_original_database_and_actual_database_mismatch_fail_closed(self):
        with patch.dict(os.environ, {'DB_NAME': 'futsaldb'}), self.assertRaises(ValueError):
            sync.import_rows([row()], self.state)
        self.db.cursor.assert_not_called()
        self.cur.fetchone.return_value = {'db_name': 'futsaldb'}
        with self.assertRaises(ValueError), patch.object(sync.repository, 'create_video') as create:
            sync.import_rows([row()], self.state)
        create.assert_not_called()
        self.assertFalse(self.state.exists())

    def test_failed_database_write_does_not_record_success(self):
        with patch.object(sync.repository, 'find_youtube_id', return_value=None), patch.object(sync.repository, 'create_video', side_effect=pymysql.err.OperationalError(2006, 'internal secret')):
            with self.assertRaises(pymysql.err.OperationalError):
                sync.import_rows([row()], self.state)
        self.db.rollback.assert_called_once()
        self.db.commit.assert_not_called()
        self.assertFalse(self.state.exists())

    def test_concurrent_manual_registration_is_not_a_sync_failure(self):
        with patch.object(sync.repository, 'find_youtube_id', side_effect=[None, {'video_id': 3}]), patch.object(sync.repository, 'create_video', side_effect=pymysql.err.IntegrityError(1062, 'duplicate')):
            result = sync.import_rows([row()], self.state)
        self.assertEqual(result['already_registered'], 1)
        self.db.commit.assert_not_called()
        self.assertIn('abcdefghijk', sync.load_seen(self.state))

    def test_corrupt_state_stops_without_database_writes(self):
        self.state.write_text('{broken', encoding='utf-8')
        with self.assertRaises(json.JSONDecodeError):
            sync.import_rows([row()], self.state)
        self.db.cursor.assert_not_called()

    def test_partial_success_is_saved_before_later_failure(self):
        with patch.object(sync.repository, 'find_youtube_id', return_value=None), patch.object(sync.repository, 'create_video', side_effect=[{}, pymysql.err.OperationalError(2006, 'failed')]):
            with self.assertRaises(pymysql.err.OperationalError):
                sync.import_rows([row(), row('12345678901')], self.state)
        self.assertEqual(sync.load_seen(self.state), {'abcdefghijk'})
        self.db.commit.assert_called_once()


if __name__ == '__main__':
    unittest.main()
