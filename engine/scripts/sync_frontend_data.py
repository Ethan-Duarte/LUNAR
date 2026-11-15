"""Synchronize independently generated LUNAR Python data with React/Vite public assets.

Read-only on web/ and data/: no SPICE or LOLA source files are changed.
Run after every survey or DEM export. Outputs JSON with explicit demo/real provenance.
"""
from __future__ import annotations
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'frontend' / 'public' / 'data'
MAP = {
    'data.js': ('LUNAR_DATA', 'lunar.json'),
    'survey.js': ('LUNAR_SURVEY', 'survey.json'),
    'survey_terrain.js': ('LUNAR_SURVEY_TERRAIN', 'terrain.json'),
    'global_moon.js': ('LUNAR_GLOBAL_DEM', 'global_dem.json'),
}

def parse_assignment(path: Path, name: str):
    if not path.is_file():
        raise FileNotFoundError(f'Missing required frontend science source: {path}')
    raw = path.read_text(encoding='utf-8')
    m = re.match(r'\s*window\.'+re.escape(name)+r'\s*=\s*', raw)
    if not m:
        raise ValueError(f'{path.name} does not begin with expected window.{name} assignment')
    text = raw[m.end():].strip()
    decoder=json.JSONDecoder()
    value,index=decoder.raw_decode(text)
    remainder=text[index:].strip()
    if remainder and not (remainder.startswith(';') or remainder.startswith('//')):
        raise ValueError(f'Unexpected trailing text in {path.name}; refusing to misparse dataset')
    return value

def sync():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    info={}
    for filename,(name, dest) in MAP.items():
        value=parse_assignment(ROOT/'web'/filename,name)
        (OUTPUT/dest).write_text(json.dumps(value,separators=(',',':'),allow_nan=False),encoding='utf-8')
        if isinstance(value,dict):
            info[filename]={'status':'loaded','sites':len(value.get('sites',[])),
                            'survey_candidates':len(value.get('top_sites',[])),
                            'terrain_tiles':len(value.get('tiles',[])),
                            'synthetic':bool(value.get('kind','').upper().startswith('SYNTHETIC'))}
        else:
            info[filename]={'status':'null / not yet generated'}
    dst=OUTPUT/'assets';dst.mkdir(exist_ok=True)
    copied=[]
    for filename in ['lroc_color_2k.jpg','lroc_color_4k.jpg']:
        path=ROOT/'web'/'assets'/filename
        if path.is_file():
            shutil.copy2(path,dst/filename)
            copied.append(filename)
    if not copied: print('NOTE: no LROC photo files at web/assets. Globe will use neutral fallback material.')
    info['lroc_textures']=copied
    info['synced_at_utc']=datetime.now(timezone.utc).isoformat()
    (OUTPUT/'manifest.json').write_text(json.dumps(info,indent=2),encoding='utf-8')
    print('LUNAR React data synchronized:')
    for key,value in info.items():
        if key!='synced_at_utc':print(' ',key,value)
    print('Output:',OUTPUT)
    return info

if __name__=='__main__':sync()
