"""Regression checks for entrypoints and root-relative paths after file moves."""
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

from src.paths import PROJECT_ROOT


class ProjectStructureTests(unittest.TestCase):
    def test_existing_server_entrypoint_and_data_paths(self):
        import main
        from src import app
        from src.cli import postgres_migrate, youtube_sync

        self.assertIs(main.app, app.app)
        self.assertEqual(PROJECT_ROOT, Path(__file__).resolve().parents[1])
        self.assertEqual(app.APP_ROOT, PROJECT_ROOT)
        self.assertEqual(app.STATIC_DIR, PROJECT_ROOT / 'public')
        self.assertEqual(app.VIDEO_DB_FILE, PROJECT_ROOT / 'uploads/videos/videos.json')
        self.assertEqual(postgres_migrate.ROOT, PROJECT_ROOT)
        self.assertEqual(youtube_sync.STATE_PATH, PROJECT_ROOT / '.wgh-sync/youtube-state.json')

    def test_existing_cli_commands_work_outside_the_project_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            for name in ('manage_auth', 'postgres_migrate', 'youtube_sync'):
                with self.subTest(command=name):
                    result = subprocess.run(
                        [sys.executable, str(PROJECT_ROOT / f'{name}.py'), '--help'],
                        cwd=directory, capture_output=True, text=True, timeout=30,
                    )
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertIn('usage:', result.stdout)

    def test_vercel_build_preserves_assets_and_can_import_the_existing_entrypoint(self):
        # Build only an isolated copy: never rewrite the working public/ directory.
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in ('src', 'public'):
                shutil.copytree(PROJECT_ROOT / name, root / name,
                                ignore=shutil.ignore_patterns('__pycache__'))
            for name in ('main.py', 'build_vercel.py'):
                shutil.copy2(PROJECT_ROOT / name, root / name)
            original = {str(p.relative_to(root / 'public')): p.read_bytes()
                        for p in (root / 'public').rglob('*') if p.is_file()}
            environment = {**os.environ, 'VERCEL': '1'}
            result = subprocess.run([sys.executable, 'build_vercel.py'], cwd=root,
                                    env=environment, capture_output=True, text=True, timeout=30)
            self.assertEqual(result.returncode, 0, result.stderr)
            from src.cli.build_vercel import PROTECTED_PAGES
            for name, content in original.items():
                self.assertEqual((root / 'wgh_web' / name).read_bytes(), content, name)
                if name in PROTECTED_PAGES:
                    self.assertIn('/_wgh_pages/' + name,
                                  (root / 'public' / name).read_text(encoding='utf-8'))
                else:
                    self.assertEqual((root / 'public' / name).read_bytes(), content, name)
            check = (
                'from pathlib import Path; from main import app; '
                'from src.app import STATIC_DIR, VIDEO_DIR; '
                'assert STATIC_DIR == Path.cwd() / "wgh_web"; '
                'assert VIDEO_DIR == Path("/tmp/wgh/uploads/videos"); '
                'assert app.openapi()["info"]["title"] == "WGH Futsal Match API"'
            )
            result = subprocess.run([sys.executable, '-c', check], cwd=root,
                                    env=environment, capture_output=True, text=True, timeout=30)
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_local_build_guard_does_not_rewrite_public_files(self):
        from src.cli.build_vercel import main
        from unittest.mock import patch
        with patch.dict(os.environ, {'VERCEL': ''}):
            with self.assertRaisesRegex(SystemExit, 'Run only inside a Vercel build'):
                main()
