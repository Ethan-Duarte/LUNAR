"""Verify local NASA/JPL SPICE kernels; no network required.
From the installed LUNAR project root: py scripts\\check_kernels.py
"""
from pathlib import Path
from download_kernels import ROOT,DIR,SOURCES,MIN_SIZE

def main():
    print('LUNAR project root:', ROOT.resolve())
    print('Expected kernel directory:', DIR.resolve())
    missing=[]
    for name in SOURCES:
        path=DIR/name
        size=path.stat().st_size if path.is_file() else 0
        good=size>=MIN_SIZE[name]
        print(('OK     ' if good else 'MISSING'),f'{name:34}',f'{size:,} bytes',flush=True)
        if not good:missing.append(name)
    if missing:
        print('Kernels missing or truncated:',', '.join(missing))
        print('Run: py scripts\\download_kernels.py')
        return 1
    print('All required kernel files have acceptable sizes.')
    print('Restart START_LUNAR_SCIENCE.bat and check Science Lab again.')
    return 0
if __name__=='__main__':
    raise SystemExit(main())
