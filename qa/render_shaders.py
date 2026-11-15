"""Compile and render the shipped terrain GLSL with real upstream LOLA on Mesa EGL.
Offscreen engineering check; not a browser screenshot or an independent terrain source.
"""
from pathlib import Path
import re,json,math,sys
import numpy as np
import moderngl
from PIL import Image
from scipy.ndimage import map_coordinates
root=Path(__file__).resolve().parents[1]
src=root/'frontend/src/scene';out=root/'qa';out.mkdir(exist_ok=True)
def template(path,name):
 text=path.read_text();return re.search(r'const '+name+r'\s*=.*?`([\s\S]*?)`',text).group(1)
shade=template(src/'shading.ts','SHADING_GLSL');cut=template(src/'shading.ts','CUT_GLSL').replace('${MAX_CUTS}','5')
vert=template(src/'MoonTerrain.tsx','vertexShader');frag=template(src/'MoonTerrain.tsx','fragmentShader').replace('${SHADING_GLSL}',shade).replace('${CUT_GLSL}',cut).replace('${steps}','120')
def convert(s,fragment=False):
 s=s.replace('precision highp float;','').replace('texture2D','texture').replace('varying ', 'in ' if fragment else 'out ').replace('attribute ','in ')
 if fragment:s='out vec4 fragColor;\n'+s.replace('gl_FragColor','fragColor')
 else:s='uniform mat4 projectionMatrix;uniform mat4 modelViewMatrix;in vec3 position;\n'+s
 return '#version 330\n'+s
ctx=moderngl.create_standalone_context(backend='egl');p=ctx.program(vertex_shader=convert(vert),fragment_shader=convert(frag,True))
print('Compiled shipped MoonTerrain GLSL:',ctx.info['GL_RENDERER'])
# Also compile the exact globe stages, including the shared shadow-floor uniform.
gv=template(src/'Globe.tsx','vertexShader').replace('${SHADING_GLSL}',shade)
gf=template(src/'Globe.tsx','fragmentShader').replace('${SHADING_GLSL}',shade).replace('${CUT_GLSL}',cut)
globe_program=ctx.program(vertex_shader=convert(gv),fragment_shader=convert(gf,True))
print('Compiled shipped Globe GLSL')
meta=json.loads((root/'frontend/public/data/terrain/sp_meta.json').read_text());levels=meta['levels'];arrays=[]
for k,l in enumerate(levels):
 a=np.asarray(Image.open(root/'frontend/public/data/terrain'/l['file'])).astype('float32');h=(a[:,:,0]*256+a[:,:,1])*.5-10000;h[(a[:,:,:3]==0).all(axis=2)]=-32768;arrays.append(h)
 t=ctx.texture((l['size'],l['size']),1,h.astype('f4').tobytes(),dtype='f4');t.filter=(moderngl.LINEAR,moderngl.LINEAR);t.repeat_x=t.repeat_y=False;t.use(k)
 p[f'uH{k}']=k;p[f'uExt{k}']=tuple(l[a]/1000 for a in ['x_min_m','y_min_m','x_max_m','y_max_m']);p[f'uPix{k}']=l['pixel_m']/1000
# Use exactly the body's south-polar frame as the application.
p['uAx']=(0,1,0);p['uAy']=(1,0,0);p['uUp']=(0,0,-1);p['uR']=1737.4
for name,v in {'uSteps':120,'uGrowth':1.08,'uMode':0,'uEdge':304.,'uFade':30.,'uCutN':0,'uExpo':8.25,'uHasMap':0.,'uHasDem':0.,'uLonLeft':-math.pi,'uDemPx':(1/4096,1/2048)}.items():
 if name in p:p[name]=v
blank=ctx.texture((1,1),4,bytes([110,110,110,255]));blank.use(2)
for n in ['uMap','uDem','uOverlay','uScore']:
 if n in p:p[n]=2
# True current SPICE body directions from the shipped browser ephemeris.
j=json.loads((root/'frontend/public/data/ephem/ephem.json').read_text());index=25200
v=np.fromfile(root/'frontend/public/data/ephem/ephem.bin',dtype='<f4').reshape(-1,8)[index]
sun=v[:3]/np.linalg.norm(v[:3]);p['uSun']=tuple(sun);p['uSunRad']=math.asin(695700/v[3])
# Native 80-m measured geometry over 40 km, not a height exaggeration.
n=501;xx,yy=np.meshgrid(np.linspace(-32,8,n),np.linspace(-32,8,n));l=levels[1];h=map_coordinates(arrays[1],[(l['y_max_m']-yy*1000)/80-.5,(xx*1000-l['x_min_m'])/80-.5],order=1,mode='nearest')/1000
rho=(xx*xx+yy*yy)/(4*1737.4**2);k=1/(1+rho);d=np.stack([yy/1737.4*k,xx/1737.4*k,-(1-rho)*k],-1);pos=d*(1737.4+h)[...,None]
vertices=np.concatenate([pos,np.stack([xx,yy],-1)],-1).astype('f4').reshape(-1,5);q=np.arange(n*n).reshape(n,n);inds=np.stack([q[:-1,:-1],q[:-1,1:],q[1:,:-1],q[:-1,1:],q[1:,1:],q[1:,:-1]],-1).astype('u4').ravel()
vao=ctx.vertex_array(p,[(ctx.buffer(vertices.tobytes()),'3f 2f','position','aXY')],ctx.buffer(inds.tobytes()))
centre=pos[n//2,n//2];up=centre/np.linalg.norm(centre);eye=centre+up*16+np.array([10.,12.,0]);forward=(centre-eye);forward/=np.linalg.norm(forward);right=np.cross(forward,up);right/=np.linalg.norm(right);camera_up=np.cross(right,forward);view=np.eye(4);view[:3,:3]=np.stack([right,camera_up,-forward]);view[:3,3]=-view[:3,:3]@eye
near=.05;far=10000;aspect=1.6;f=1/math.tan(math.radians(45)/2);proj=np.zeros((4,4));proj[0,0]=f/aspect;proj[1,1]=f;proj[2,2]=(far+near)/(near-far);proj[2,3]=2*far*near/(near-far);proj[3,2]=-1
p['projectionMatrix'].write(proj.astype('f4').T.tobytes());p['modelViewMatrix'].write(view.astype('f4').T.tobytes());fb=ctx.simple_framebuffer((960,600));fb.use();ctx.enable(moderngl.DEPTH_TEST)
images={}
for label,fill in [('deep',.0015),('inspect',.03)]:
 p['uShadowFill']=fill;fb.clear(0,0,0,1);vao.render();a=np.frombuffer(fb.read(components=3),dtype='u1').reshape(600,960,3)[::-1];Image.fromarray(a).save(out/f'terrain_shader_{label}.png');images[label]=a
assert np.any(images['deep']!=images['inspect']),'Shadow uniform did not affect real render'
assert images['deep'].mean()<images['inspect'].mean()
report={'renderer':ctx.info['GL_RENDERER'],'compiled_shader':'MoonTerrain.tsx + shading.ts; Globe.tsx stages also compiled','measured_source':'supplied sp_dem_L0/L1 PNGs; native 80 m geometry','size':[960,600],'deep_fill':.0015,'inspect_fill':.03,'deep_mean':float(images['deep'].mean()),'inspect_mean':float(images['inspect'].mean()),'note':'Offscreen GLSL engineering check, not a browser capture; no full browser GPU validation.'}
(out/'shader_check.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
