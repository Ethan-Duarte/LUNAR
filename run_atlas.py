"""LUNAR Field Atlas localhost launcher. Browser frontend adapts Apache-2.0 Lunar Navigator;
The Python backend lives under engine/; new V1 single-site studies include Earth occultation. Archived studies remain unchanged.
No internet, npm, CDN or third-party UI runtime is required for the bundled viewer.
"""
from __future__ import annotations
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import mimetypes, json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from pathlib import Path
import os, sys, subprocess, webbrowser, time, threading, socket, re

ROOT=Path(__file__).resolve().parent
API='http://127.0.0.1:8766'
ENGINE=ROOT/'engine'
FRONT=ROOT/'app'
ROUTES={'/api/health','/api/analyze','/api/surface','/api/sensitivity','/api/visual-terrain','/api/terrain-screen'}

class Server(SimpleHTTPRequestHandler):
    """Serve browser modules with explicit MIME types regardless of Windows registry.

    On some Windows Python installations mimetypes.guess_type('main.js') returns
    text/plain. Chromium strictly refuses to execute ES modules with that MIME.
    Python's system registry must never determine the module Content-Type.
    """
    _explicit_mimes = {
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.json': 'application/json',
        '.css': 'text/css',
        '.wasm': 'application/wasm',
        '.html': 'text/html',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.ico': 'image/x-icon',
    }
    def guess_type(self, path):
        suffix=Path(path).suffix.lower()
        return self._explicit_mimes.get(suffix) or super().guess_type(path)
    def end_headers(self):
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Cache-Control','no-cache')
        super().end_headers()
    def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(FRONT),**kwargs)
    def do_GET(self):
        if self.path in ROUTES: self._forward();return
        return super().do_GET()
    def do_POST(self):
        if self.path in ROUTES and self.path!='/api/health':self._forward();return
        self.send_error(404,'Unknown science endpoint')
    def _forward(self):
        data=None
        if self.command=='POST':
            try: size=int(self.headers.get('Content-Length','0'))
            except ValueError: return self.send_error(400,'Invalid Content-Length')
            if size<1 or size>8000:return self.send_error(413,'Study request outside 1..8000 bytes')
            data=self.rfile.read(size)
        req=Request(API+self.path,method=self.command,data=data,
                    headers={'Content-Type':'application/json'} if data is not None else {})
        try:
            with urlopen(req,timeout=3600) as res:
                self._copy_response(res.status,res.read())
        except HTTPError as exc:self._copy_response(exc.code,exc.read())
        except (URLError,TimeoutError,ConnectionError) as exc:
            import json
            body=json.dumps({'error':f'Local scientific engine is unavailable at {API}. Run the engine with installed Python requirements and NASA SPICE kernels.'}).encode()
            self._copy_response(503,body)
    def _copy_response(self,status,body):
        self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(body)
    def log_message(self,fmt,*args):
        if not self.path.endswith('ephemeris.json'):super().log_message(fmt,*args)

def main():
    import argparse
    p=argparse.ArgumentParser(description='Launch LUNAR Atlas on localhost')
    p.add_argument('--port',type=int,default=5195)
    p.add_argument('--self-test',action='store_true',help='Verify HTTP module MIME and shipped assets without starting the UI')
    p.add_argument('--no-engine',action='store_true',help='Serve bundled measured examples only')
    p.add_argument('--open-browser',action='store_true')
    args=p.parse_args()
    required=['index.html','lunar/data/manifest.json','lunar/data/sites/ridge-2m.json','data/missions.json','data/ephem/ephem.json','data/globe/globe.json']
    if (FRONT/'index.html').is_file() and 'LUNAR V1.' not in (FRONT/'index.html').read_text():
        print('WRONG VIEWER BUILD in '+str(FRONT.resolve()),flush=True)
        print('Extract the complete release ZIP into a fresh folder; an older app/index.html is present.',flush=True)
        return 2
    if (FRONT/'index.html').is_file():
        required += [a.removeprefix('./') for a in re.findall(r'(?:src|href)="([^" ]+\.(?:js|css))"', (FRONT/'index.html').read_text())]
    absent=[name for name in required if not (FRONT/name).is_file()]
    if absent:
        print('INCOMPLETE ATLAS INSTALLATION: missing '+', '.join(absent),flush=True)
        print('Extract the ENTIRE ZIP into a new directory before running the launcher.',flush=True)
        return 2
    if args.self_test:
        with ThreadingHTTPServer(('127.0.0.1',0),Server) as probe:
            worker=threading.Thread(target=probe.serve_forever,daemon=True)
            worker.start()
            try:
                items={'/':'text/html','/lunar/data/manifest.json':'application/json',
                       '/lunar/data/sites/ridge-2m.json':'application/json',
                       '/data/missions.json':'application/json','/data/globe/globe.json':'application/json'}
                for asset in (FRONT/'assets').iterdir():
                    if asset.suffix in ('.js','.css'):
                        items['/assets/'+asset.name]=Server._explicit_mimes[asset.suffix]
                for route,expected in items.items():
                    with urlopen(Request(f'http://127.0.0.1:{probe.server_port}{route}',method='HEAD'),timeout=5) as response:
                        actual=response.headers.get_content_type()
                        if response.status != 200 or actual!=expected:
                            raise RuntimeError(f'{route}: expected HTTP 200 {expected}, got {response.status} {actual}')
                        print(f'PASS {route}: {actual}',flush=True)
                # Windows registry sometimes overrides .js as text/plain; ensure
                # our explicit mapping remains correct even under that condition.
                mimetypes.add_type('text/plain','.js')
                assert Server._explicit_mimes['.js']=='text/javascript'
                print('PASS Windows .js MIME override; all required assets served.',flush=True)
                return 0
            finally:
                probe.shutdown()
                worker.join(timeout=3)
    global API
    engine=None
    import importlib.util
    missing_python=[m for m in ['numpy','spiceypy','rasterio','pyproj','scipy','numba'] if importlib.util.find_spec(m) is None]
    if not args.no_engine and missing_python:
        print('Viewer ready; new Python studies need setup: '+', '.join(missing_python),flush=True)
        print('Run SETUP_SCIENCE.bat once, then restart this launcher.',flush=True)
        args.no_engine=True
    if not args.no_engine:
        # Each launch owns a separate science port. Never query an older LUNAR engine.
        with socket.socket() as port_probe:
            port_probe.bind(('127.0.0.1',0))
            science_port=port_probe.getsockname()[1]
        API=f'http://127.0.0.1:{science_port}'
        print('Starting the LUNAR V1 scientific engine…',flush=True)
        engine=subprocess.Popen([sys.executable,str(ENGINE/'scripts/science_server.py')],cwd=str(ENGINE),env={**os.environ,'LUNAR_SCIENCE_PORT':str(science_port)})
        time.sleep(.45)
        if engine.poll() is not None:
            print('Science engine exited early. Bundled source-backed examples still work.',flush=True)
            print('Install engine/requirements.txt and original NASA kernels into engine/data/kernels.',flush=True)
    try:
        # An earlier LUNAR build may already own the requested port. Never silently
        # open that unrelated application and pretend it is this Atlas build.
        host=None
        choices=[args.port]+[p for p in range(5195,5215) if p!=args.port]
        for port in choices:
            try:
                host=ThreadingHTTPServer(('127.0.0.1',port),Server)
                host.daemon_threads=True
                if port!=args.port:print(f'Port {args.port} was occupied; using {port} instead.',flush=True)
                break
            except OSError as error:
                if getattr(error,'errno',None) not in (48,98,10048):raise
        if host is None:raise OSError('All Atlas ports are in use. Close older Atlas launchers.')
        url=f'http://127.0.0.1:{host.server_port}/?build=lunar-v1.0'
        print('\nLUNAR FIELD ATLAS V1.0 · '+url,flush=True)
        print('ES module MIME types explicitly set to text/javascript (Windows-safe).',flush=True)
        print('IMPORTANT: open this http:// URL, never app/index.html as a file:// page.',flush=True)
        print('Serving build from: '+str(FRONT.resolve()),flush=True)
        print('Ctrl+C stops the frontend and spawned science engine.',flush=True)
        if args.open_browser:webbrowser.open(url)
        host.serve_forever()
    except KeyboardInterrupt:pass
    finally:
        if engine and engine.poll() is None:
            engine.terminate()
            try:engine.wait(timeout=4)
            except subprocess.TimeoutExpired:engine.kill()

if __name__=='__main__':sys.exit(main())
