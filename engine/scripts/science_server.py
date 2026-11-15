"""Local-only LUNAR science API. Launch with START_LUNAR_SCIENCE.bat.

Bound to 127.0.0.1, not publicly exposed. Vite proxies /api to port 8765.
No arbitrary DEM file paths accepted from the web UI. One analysis at a time
because SpiceyPy global kernel state is not threadsafe.
"""
from __future__ import annotations
import json,sys,threading,traceback,os
from dataclasses import fields
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from lunar.mission_analysis import Request,analyze
LOCK=threading.Lock()
FIELDS={f.name for f in fields(Request)}-{'dem','auto_download'}

class Handler(BaseHTTPRequestHandler):
    def answer(self,code,payload):
        blob=json.dumps(payload,allow_nan=False,separators=(',',':')).encode('utf-8')
        self.send_response(code);self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Content-Length',str(len(blob)))
        self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff')
        self.end_headers();self.wfile.write(blob)
    def do_GET(self):
        if self.path=='/api/health':
            from lunar.geometry import KERNELS
            root_kernels=ROOT/'data'/'kernels'
            missing=[n for n in KERNELS if not (root_kernels/n).is_file()]
            self.answer(200,{'ready':True,'compute_ready':not missing,'kernels_missing':missing,
                             'model':'SPICE + NASA LOLA bounded horizon','version':'1.0.0'})
        else:self.answer(404,{'error':'Unknown route'})
    def do_POST(self):
        if self.path not in ['/api/analyze','/api/surface','/api/sensitivity','/api/visual-terrain','/api/terrain-screen']:return self.answer(404,{'error':'Unknown route'})
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=8000:raise ValueError('Request must be JSON, 1..8000 bytes')
            payload=json.loads(self.rfile.read(size))
            if self.path=='/api/analyze':
                if not isinstance(payload,dict) or any(k not in FIELDS for k in payload):raise ValueError('Invalid analysis parameters')
                req=Request(**payload);req.validate()
            else:
                allowed=({'lat','lon','radius_km'} if self.path=='/api/surface' else {'lat','lon','remote_20m'} if self.path=='/api/visual-terrain' else {'lat','lon','start','days','step_hours','footprint_m','height_m','terrain_radius_km','sun_rule','earth_clearance_deg'} if self.path=='/api/sensitivity' else {'lat','lon','radius_m','max_slope_deg','max_roughness_m'})
                if not isinstance(payload,dict) or any(k not in allowed for k in payload):raise ValueError('Invalid study parameters')
        except (ValueError,TypeError,KeyError) as exc:return self.answer(400,{'error':str(exc)})
        if not LOCK.acquire(blocking=False):return self.answer(429,{'error':'Another science study is in progress; retry after it finishes.'})
        try:
            if self.path=='/api/analyze':result=analyze(req,ROOT)
            elif self.path=='/api/terrain-screen':
                from lunar.terrain_screen import screen_location
                result=screen_location(ROOT,**payload)
            elif self.path=='/api/visual-terrain':
                from lunar.visual_tiles import export_visual_tiles
                result=export_visual_tiles(ROOT, **payload)
            else:
                from lunar.trade_study import surface_export,sensitivity
                result=(surface_export if self.path=='/api/surface' else sensitivity)(ROOT,**payload)
            return self.answer(200,result)
        except (ValueError,FileNotFoundError,RuntimeError) as exc:
            print('LUNAR analysis error:',str(exc),flush=True)
            return self.answer(422,{'error':str(exc)})
        except Exception as exc:
            traceback.print_exc();return self.answer(500,{'error':'Scientific backend failed; see science server console: '+type(exc).__name__})
        finally:LOCK.release()
    def log_message(self,fmt,*args):print('LUNAR API:',fmt%args,flush=True)

if __name__=='__main__':
    port=int(os.environ.get('LUNAR_SCIENCE_PORT','8765'))
    print(f'LUNAR advanced science API on http://127.0.0.1:{port}/api/health',flush=True)
    print('Local only. Close this window to stop the advanced science engine.',flush=True)
    ThreadingHTTPServer(('127.0.0.1',port),Handler).serve_forever()
