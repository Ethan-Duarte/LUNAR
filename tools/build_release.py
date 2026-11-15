"""Build a portable LUNAR source + prebuilt viewer release after npm run build."""
from pathlib import Path
import shutil,zipfile,hashlib,json
ROOT=Path(__file__).resolve().parents[1]
def main():
    if not (ROOT/'frontend/dist/index.html').is_file():raise RuntimeError('Run npm run build in frontend first')
    if (ROOT/'app').exists():shutil.rmtree(ROOT/'app')
    shutil.copytree(ROOT/'frontend/dist',ROOT/'app')
    output=ROOT.parent/'LUNAR_V1.0_Complete.zip'
    excluded={'node_modules','dist','__pycache__','.pytest_cache','.git','.vite','validation_cache'}
    files=[]
    for p in sorted(ROOT.rglob('*')):
        rel=p.relative_to(ROOT)
        if any(x in excluded for x in rel.parts) or not p.is_file():continue
        if p.is_symlink():continue
        if p.suffix in ['.pyc','.nbc','.nbi','.tsbuildinfo'] or p.name.endswith('.part'):continue
        if p.name in ['LOLA_GLOBAL_16PPD_UINT.tif','RELEASE_MANIFEST.json']:continue
        if p.name in ['LDEM_80S_80MPP_ADJ.TIF','LDEM_60S_240MPP_ADJ.TIF']:continue
        files.append(p)
    manifest=[{'path':str(p.relative_to(ROOT)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files]
    (ROOT/'RELEASE_MANIFEST.json').write_text(json.dumps({'version':'1.0.0','files':manifest},indent=2))
    files.append(ROOT/'RELEASE_MANIFEST.json')
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for p in files:z.write(p,Path('LUNAR_V1.0')/p.relative_to(ROOT))
    with zipfile.ZipFile(output) as z:assert z.testzip() is None
    print(output,len(files),'files',round(output.stat().st_size/1024**2,1),'MiB')
if __name__=='__main__':main()
