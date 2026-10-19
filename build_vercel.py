"""Keep protected HTML behind FastAPI rather than the public CDN. Vercel build only."""
import os
from pathlib import Path

def main():
    if os.getenv('VERCEL')!='1':
        raise SystemExit('Run only inside a Vercel build. Local public/ stays unchanged.')
    root=Path(__file__).resolve().parent
    source=root/'public'
    target=root/'wgh_web'
    if source.parent!=root or target.parent!=root:raise SystemExit('Unexpected build paths')
    if not source.is_dir():raise SystemExit('Missing public source directory')
    if target.exists():raise SystemExit('Refusing to overwrite an existing wgh_web directory')
    source.rename(target)
    print('WGH web assets packaged for FastAPI with authenticated page checks.')

if __name__=='__main__':main()
