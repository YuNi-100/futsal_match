"""Retain public assets for Vercel collection; route private HTML through FastAPI."""
import os
import shutil
from src.paths import PROJECT_ROOT

PROTECTED_PAGES=('video.html','video-register.html','feedback-review.html','feedback.html','video_backup.html')

def main():
    if os.getenv('VERCEL')!='1':
        raise SystemExit('Run only inside a Vercel build. Local public/ stays unchanged.')
    root=PROJECT_ROOT
    source=root/'public'
    target=root/'wgh_web'
    if source.parent!=root or target.parent!=root:raise SystemExit('Unexpected build paths')
    if not source.is_dir():raise SystemExit('Missing public source directory')
    if target.exists():raise SystemExit('Refusing to overwrite an existing wgh_web directory')
    # Vercel has already inventoried public assets; never move/remove those paths.
    shutil.copytree(source,target)
    for page in PROTECTED_PAGES:
        file=source/page
        if not file.exists():continue
        destination='/_wgh_pages/'+page
        file.write_text('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="robots" content="noindex"><title>WGH</title><script>location.replace('+repr(destination)+'+location.search+location.hash);</script><a href="'+destination+'">계속하기</a></html>',encoding='utf-8')
    print('WGH public asset paths preserved; private HTML served through authenticated FastAPI routes.')

if __name__=='__main__':main()
