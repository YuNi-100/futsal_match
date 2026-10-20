"""Explicitly started, test-DB-only WGH YouTube feed synchronizer.

Default: read-only preview. --apply: one import. --apply --watch: poll until stopped.
No web endpoint, AI calls, downloads, schema changes or server startup hooks.
"""
import argparse
from contextlib import contextmanager
from datetime import date, datetime, timezone
import json
import os
from pathlib import Path
from src.paths import PROJECT_ROOT
import re
import tempfile
import time
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

from dotenv import load_dotenv
import pymysql
from src.db.database import engine, is_postgres, assert_postgres_writes
from src.db import video_repository as repository

CHANNEL_ID = 'UCmz846rJsnMWyimoMhgyEow'
TEST_DATABASE = 'futsaldb_test'
ROOT = PROJECT_ROOT
STATE_PATH = ROOT / '.wgh-sync' / 'youtube-state.json'
NS = {'a': 'http://www.w3.org/2005/Atom', 'yt': 'http://www.youtube.com/xml/schemas/2015'}
DATE_PATTERN = re.compile(r'(?<!\d)(\d{4}-\d{2}-\d{2})(?!\d)')
VIDEO_PATTERN = re.compile(r'[A-Za-z0-9_-]{11}')


def classify_title(title):
    if not ('wgh' in title.casefold() or '은평' in title or '친선경기' in title):
        return None, '키워드 없음'
    if not title.strip() or len(title) > 200:
        return None, '제목 길이 초과'
    dates = DATE_PATTERN.findall(title)
    if len(dates) != 1:
        return None, 'YYYY-MM-DD 날짜가 정확히 하나 필요'
    try:
        match_date = date.fromisoformat(dates[0])
    except ValueError:
        return None, '유효하지 않은 경기 날짜'
    if match_date.year < 1000:
        return None, 'MySQL 지원 날짜 범위 밖'
    return match_date.isoformat(), None


def homepage_title(title, match_date):
    """Remove only the extracted match date; preserve other title numbers."""
    cleaned = DATE_PATTERN.sub(lambda match: '' if match.group(1) == match_date else match.group(0), title)
    return re.sub(r'\s+', ' ', cleaned).strip()


def parse_feed(data):
    root = ET.fromstring(data)
    # YouTube's feed-level channelId can omit UC; entry-level IDs include it.
    if (root.tag != '{' + NS['a'] + '}feed'
            or root.findtext('yt:channelId', namespaces=NS) not in (CHANNEL_ID, CHANNEL_ID[2:])):
        raise ValueError('설정한 채널의 피드가 아닙니다.')
    rows = []
    seen = set()
    for entry in root.findall('a:entry', NS):
        video_id = entry.findtext('yt:videoId', '', NS)
        channel = entry.findtext('yt:channelId', '', NS)
        if not VIDEO_PATTERN.fullmatch(video_id) or channel != CHANNEL_ID:
            raise ValueError('피드 영상 ID 또는 채널 정보가 잘못되었습니다.')
        if video_id in seen:
            continue
        seen.add(video_id)
        title = entry.findtext('a:title', '', NS).strip()
        match_date, reason = classify_title(title)
        rows.append(dict(youtube_id=video_id, title=title, match_date=match_date, skip_reason=reason))
    return rows


def fetch_rss_feed():
    url = 'https://www.youtube.com/feeds/videos.xml?channel_id=' + CHANNEL_ID
    request = Request(url, headers={'User-Agent': 'WGH-Video-Sync/1.0'})
    with urlopen(request, timeout=20) as response:
        data = response.read(2_000_001)
    if len(data) > 2_000_000:
        raise ValueError('피드 크기가 제한을 초과했습니다.')
    return parse_feed(data)


def parse_channel_page(page):
    match = re.search(r'var ytInitialData = (.*?);</script>', page)
    if not match:
        raise ValueError('채널 페이지의 영상 정보를 읽지 못했습니다.')
    data = json.loads(match.group(1))
    channel = data.get('metadata', {}).get('channelMetadataRenderer', {}).get('externalId')
    if channel != CHANNEL_ID:
        raise ValueError('설정한 채널의 페이지가 아닙니다.')
    rows, seen = [], set()

    def walk(node):
        if isinstance(node, dict):
            for key in ('videoRenderer', 'lockupViewModel'):
                item = node.get(key)
                if not isinstance(item, dict):
                    continue
                if key == 'videoRenderer':
                    title = ''.join(part.get('text', '') for part in item.get('title', {}).get('runs', []))
                    video_id = item.get('videoId', '')
                else:
                    title = item.get('metadata', {}).get('lockupMetadataViewModel', {}).get('title', {}).get('content', '')
                    video_id = item.get('contentId', '')
                if title and VIDEO_PATTERN.fullmatch(video_id) and video_id not in seen:
                    seen.add(video_id)
                    match_date, reason = classify_title(title)
                    rows.append(dict(youtube_id=video_id, title=title, match_date=match_date, skip_reason=reason))
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    tabs = data.get('contents', {}).get('twoColumnBrowseResultsRenderer', {}).get('tabs', [])
    selected = [tab.get('tabRenderer', {}) for tab in tabs if tab.get('tabRenderer', {}).get('selected')]
    if len(selected) != 1:
        raise ValueError('공개 동영상 탭을 확인하지 못했습니다.')
    # Only traverse the selected video tab, never recommendations elsewhere.
    walk(selected[0].get('content', {}))
    if not rows:
        raise ValueError('공개 동영상 목록을 읽지 못했습니다. 자동 등록을 건너뜁니다.')
    return rows


def fetch_feed():
    try:
        return fetch_rss_feed()
    except (OSError, ValueError, ET.ParseError):
        import sys
        print('공개 피드 조회 실패: 채널의 공개 동영상 탭으로 확인합니다.', file=sys.stderr, flush=True)
    request = Request('https://www.youtube.com/@yuni_andv5909/videos',
                      headers={'User-Agent': 'Mozilla/5.0', 'Cache-Control': 'no-cache'})
    with urlopen(request, timeout=20) as response:
        data = response.read(4_000_001)
    if len(data) > 4_000_000:
        raise ValueError('채널 페이지 크기가 제한을 초과했습니다.')
    return parse_channel_page(data.decode('utf-8'))


def load_seen(path):
    if not path.exists():
        return set()
    payload = json.loads(path.read_text(encoding='utf-8'))
    seen = payload.get('seen')
    if (payload.get('channel_id') != CHANNEL_ID or payload.get('database') != TEST_DATABASE
            or not isinstance(seen, list)
            or not all(isinstance(item, str) and VIDEO_PATTERN.fullmatch(item) for item in seen)):
        raise ValueError('동기화 이력 파일을 확인해 주세요. 자동으로 초기화하지 않습니다.')
    return set(seen)


def save_seen(path, seen):
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = dict(channel_id=CHANNEL_ID, database=TEST_DATABASE, seen=sorted(seen))
    name = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent, delete=False) as stream:
            name = stream.name
            json.dump(payload, stream, ensure_ascii=False)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
    finally:
        if name and os.path.exists(name):
            os.unlink(name)


@contextmanager
def exclusive_run(path):
    """Prevent two local workers from racing the persistent deletion history."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a+b') as stream:
        stream.seek(0, 2)
        if stream.tell() == 0:
            stream.write(b'0')
            stream.flush()
        stream.seek(0)
        if os.name == 'nt':
            import msvcrt
            msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            yield
        finally:
            stream.seek(0)
            if os.name == 'nt':
                msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(stream.fileno(), fcntl.LOCK_UN)


def import_rows(rows, state_path=STATE_PATH):
    # The original database cannot be written by this development-stage worker.
    if engine()=='mysql' and os.getenv('DB_NAME') != TEST_DATABASE:
        raise ValueError('현재 단계에서는 DB_NAME=futsaldb_test일 때만 등록할 수 있습니다.')
    seen = load_seen(state_path)
    eligible = [row for row in rows if not row['skip_reason'] and row['youtube_id'] not in seen]
    stats = dict(registered=0, already_registered=0, ignored=len(rows) - len(eligible))
    if not eligible:
        return stats
    connection = repository.connect()
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT DATABASE() AS db_name')
            db_name=cursor.fetchone()['db_name']
            if is_postgres(connection):assert_postgres_writes(connection,'sync')
            elif db_name != TEST_DATABASE:
                raise ValueError('실제 연결 DB가 futsaldb_test가 아닙니다.')
        for row in eligible:
            video_id = row['youtube_id']
            if repository.find_youtube_id(connection, video_id):
                stats['already_registered'] += 1
            else:
                try:
                    repository.create_video(connection, user_id=1, match_id=None,
                                            title=homepage_title(row['title'], row['match_date']), youtube_id=video_id,
                                            match_date=row['match_date'])
                    connection.commit()
                    stats['registered'] += 1
                except pymysql.err.IntegrityError as error:
                    connection.rollback()
                    if not error.args or error.args[0] != 1062:
                        raise
                    # A concurrent manual registration may win the unique-key race.
                    if not repository.find_youtube_id(connection, video_id):
                        raise
                    stats['already_registered'] += 1
            seen.add(video_id)
            save_seen(state_path, seen)
        return stats
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='테스트 DB에 실제 등록')
    parser.add_argument('--watch', action='store_true', help='중지할 때까지 주기적으로 확인')
    parser.add_argument('--interval', type=int, default=300, help='확인 간격(초), 최소 60')
    args = parser.parse_args(argv)
    if args.watch and not args.apply:
        parser.error('--watch에는 --apply가 필요합니다.')
    if args.interval < 60:
        parser.error('확인 간격은 60초 이상이어야 합니다.')
    load_dotenv(ROOT / '.env')
    try:
        if not args.apply:
            # Preview neither connects to MySQL nor creates a local state directory.
            rows = fetch_feed()
            print(json.dumps(dict(mode='preview', channel_id=CHANNEL_ID, videos=rows), ensure_ascii=False, indent=2))
            return 0
        if engine()=='mysql' and os.getenv('DB_NAME') != TEST_DATABASE:
            raise ValueError('현재 단계에서는 DB_NAME=futsaldb_test일 때만 등록할 수 있습니다.')
        with exclusive_run(STATE_PATH.with_suffix('.lock')):
            while True:
                try:
                    rows = fetch_feed()
                except (OSError, TimeoutError):
                    print('유튜브 연결 실패: 이번 확인을 건너뜁니다. 저장된 영상·이력은 유지합니다.', flush=True)
                    if not args.watch:
                        return 1
                    time.sleep(args.interval)
                    continue
                try:
                    stats = import_rows(rows)
                    print(json.dumps(dict(checked_at=datetime.now(timezone.utc).isoformat(), **stats), ensure_ascii=False), flush=True)
                except Exception as error:
                    # Do not automatically retry DB/state errors; resolve them before restart.
                    print('동기화 중지: ' + type(error).__name__ + ' — 설정·네트워크·처리 이력을 확인해 주세요.', flush=True)
                    return 1
                if not args.watch:
                    return 0
                time.sleep(args.interval)
    except KeyboardInterrupt:
        print('자동 등록을 중지했습니다.')
        return 0
    except Exception as error:
        print('동기화 실행 실패: ' + type(error).__name__ + ' — 설정·네트워크·처리 이력을 확인해 주세요.')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
