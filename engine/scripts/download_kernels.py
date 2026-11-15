"""Fetch official NASA JPL NAIF kernels (only when explicitly run)."""
from pathlib import Path
from urllib.request import urlopen
ROOT=Path(__file__).resolve().parents[1]
DIR=ROOT/'data'/'kernels'
BASE='https://naif.jpl.nasa.gov/pub/naif/generic_kernels/'
SOURCES={
 'naif0012.tls':'lsk/naif0012.tls',
 'pck00011.tpc':'pck/pck00011.tpc',
 'de440s.bsp':'spk/planets/de440s.bsp',
 'moon_pa_de440_200625.bpc':'pck/moon_pa_de440_200625.bpc',
 'moon_de440_250416.tf':'fk/satellites/moon_de440_250416.tf'
}
MIN_SIZE={'de440s.bsp':20_000_000,'moon_pa_de440_200625.bpc':1_000_000,
          'naif0012.tls':1000,'pck00011.tpc':50000,'moon_de440_250416.tf':1000}
def main():
    DIR.mkdir(parents=True,exist_ok=True)
    print('LUNAR root:',ROOT.resolve(),flush=True)
    print('Downloading into:',DIR.resolve(),flush=True)
    for fname,rel in SOURCES.items():
        target=DIR/fname
        if target.exists() and target.stat().st_size>MIN_SIZE[fname]:
            print('Already downloaded:', fname);continue
        print('Downloading:',BASE+rel,flush=True)
        temp=DIR/(fname+'.partial')
        try:
            with urlopen(BASE+rel,timeout=120) as resp,open(temp,'wb') as f:
                while block:=resp.read(1024*1024): f.write(block)
            if temp.stat().st_size<MIN_SIZE[fname]: raise RuntimeError('Kernel too small: '+fname)
            temp.replace(target)
        except Exception:
            temp.unlink(missing_ok=True);raise
    print('All required kernels are present in:',DIR.resolve(),flush=True)
    print('Restart the LUNAR science API window after downloading.',flush=True)
if __name__=='__main__':main()
