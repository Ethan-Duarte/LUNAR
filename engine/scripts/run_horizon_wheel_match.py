"""Run the original cross-engine scalar audit in an isolated Horizon Wheel checkout.
Usage: python engine/scripts/run_horizon_wheel_match.py /absolute/checkout
Install that checkout's npm dependencies first. No tracked peer source is changed.
"""
from pathlib import Path
import json,subprocess,sys
ROOT=Path(__file__).resolve().parents[2]
def main():
    peer=Path(sys.argv[1]).resolve();target=peer/'src/lunar-comparison.audit.test.ts'
    if target.exists():raise FileExistsError(target)
    content=(ROOT/'qa/v16/matched-template.ts.txt').read_text()
    for key,path in {'__ENGINEERING__':ROOT/'frontend/src/lunar/engineering.ts','__RADIO__':ROOT/'frontend/src/lunar/radio.ts','__WINDOWS__':ROOT/'frontend/src/lib/windows.ts','__TEST_DATA__':ROOT/'frontend/src/lib/testData.ts','__SITE_OUTPUT__':ROOT/'qa/v16/matched_flat_site.json','__OUTPUT__':ROOT/'qa/v16/matched_scalar.json'}.items():content=content.replace(key,json.dumps(path.as_posix()))
    try:
        target.write_text(content)
        subprocess.run(['node',str(peer/'node_modules/vitest/vitest.mjs'),'run','src/lunar-comparison.audit.test.ts','--maxWorkers=1'],cwd=peer,check=True)
    finally:target.unlink(missing_ok=True)
if __name__=='__main__':main()
