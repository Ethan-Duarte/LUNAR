from urllib.request import urlopen,Request
from pathlib import Path
import json,time
root=Path(__file__).resolve().parents[1]
import subprocess,sys,os,signal
log=open('/tmp/lunar-api-owned-launch.txt','w')
process=subprocess.Popen([sys.executable,str(root/'run_atlas.py'),'--port','5181'],stdout=log,stderr=log,start_new_session=True)
import atexit
atexit.register(lambda: os.killpg(process.pid,signal.SIGTERM) if process.poll() is None else None)
for _ in range(100):
 try:
  with urlopen('http://127.0.0.1:5181/api/health',timeout=1) as r:
   h=json.load(r)
   if h.get('compute_ready'):break
 except Exception:pass
 time.sleep(.1)
else:raise RuntimeError('Launcher and engine readiness timed out')
print('Health:',h,flush=True)
payload={'lat':-89.4399,'lon':222.8524,'start':'2026-11-14','days':1,'step_hours':1,'observer_height_m':2,'terrain_radius_km':300,'precision_sampling':True}
t=time.monotonic()
with urlopen(Request('http://127.0.0.1:5181/api/analyze',data=json.dumps(payload).encode(),headers={'Content-Type':'application/json'}),timeout=600) as r:j=json.load(r)
assert len(j['site']['samples'])==25
assert j['site']['horizon']['coverage_fraction']>=.995
(root/'qa/real_api_300km_study.json').write_text(json.dumps(j))
print('Full API pass:',time.monotonic()-t,'s',j['site']['metrics'],flush=True)
with urlopen(Request('http://127.0.0.1:5181/api/terrain-screen',data=json.dumps({'lat':-89.4399,'lon':222.8524,'radius_m':100}).encode(),headers={'Content-Type':'application/json'}),timeout=600) as r:screen=json.load(r)
(root/'qa/real_api_footprint.json').write_text(json.dumps(screen,indent=2));print('Footprint pass',str(screen)[:500],flush=True)
