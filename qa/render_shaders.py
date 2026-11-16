"""Compile/link the rewrite shaders on Linux Mesa/EGL. Not a browser appearance test."""
import ctypes as C,re,json
from pathlib import Path
E=C.CDLL('libEGL.so.1'); E.eglGetProcAddress.restype=C.c_void_p; E.eglGetProcAddress.argtypes=[C.c_char_p]
def fun(name,result,args):return C.CFUNCTYPE(result,*args)(E.eglGetProcAddress(name.encode()))
platform=fun('eglGetPlatformDisplayEXT',C.c_void_p,[C.c_uint,C.c_void_p,C.c_void_p]); display=platform(0x31DD,None,None)
E.eglInitialize.argtypes=[C.c_void_p,C.c_void_p,C.c_void_p];assert E.eglInitialize(display,None,None)
E.eglBindAPI(0x30A2)
attrs=(C.c_int*9)(0x3033,1,0x3040,8,0x3024,8,0x3025,0,0x3038); config=C.c_void_p();count=C.c_int()
E.eglChooseConfig.argtypes=[C.c_void_p,C.c_void_p,C.c_void_p,C.c_int,C.c_void_p];assert E.eglChooseConfig(display,attrs,C.byref(config),1,C.byref(count)) and count.value
E.eglCreateContext.argtypes=[C.c_void_p,C.c_void_p,C.c_void_p,C.c_void_p];E.eglCreateContext.restype=C.c_void_p
end=(C.c_int*1)(0x3038);context=E.eglCreateContext(display,config,None,end);assert context
E.eglMakeCurrent.argtypes=[C.c_void_p,C.c_void_p,C.c_void_p,C.c_void_p];assert E.eglMakeCurrent(display,None,None,context)
create=fun('glCreateShader',C.c_uint,[C.c_uint]);source=fun('glShaderSource',None,[C.c_uint,C.c_int,C.POINTER(C.c_char_p),C.c_void_p]);compile=fun('glCompileShader',None,[C.c_uint]);get=fun('glGetShaderiv',None,[C.c_uint,C.c_uint,C.c_void_p]);log=fun('glGetShaderInfoLog',None,[C.c_uint,C.c_int,C.c_void_p,C.c_void_p]);cp=fun('glCreateProgram',C.c_uint,[]);attach=fun('glAttachShader',None,[C.c_uint,C.c_uint]);link=fun('glLinkProgram',None,[C.c_uint]);gp=fun('glGetProgramiv',None,[C.c_uint,C.c_uint,C.c_void_p]);lp=fun('glGetProgramInfoLog',None,[C.c_uint,C.c_int,C.c_void_p,C.c_void_p])
base=Path(__file__).resolve().parents[1]/'frontend/src/scene';results=[]
for filename in ['LunarSurface.tsx','LunarGlobe.tsx']:
 text=(base/filename).read_text();common=re.search(r'const coordinates\s*=\s*`(.*?)`',text,re.S)
 stages=[]
 for name,kind in [('vertex',0x8B31),('fragment',0x8B30)]:
  code=re.search(r'const '+name+r'\s*=\s*`(.*?)`',text,re.S).group(1)
  if(common):code=code.replace('${coordinates}',common.group(1))
  prefix='#version 120\n'+('attribute vec3 position; uniform mat4 projectionMatrix,modelViewMatrix;\n' if name=='vertex' else '')
  # Desktop GLSL compatibility syntax omits ES precision qualifiers.
  code=re.sub(r'precision highp float;','',code)
  shader=create(kind);data=C.c_char_p((prefix+code).encode());source(shader,1,C.byref(data),None);compile(shader);ok=C.c_int();get(shader,0x8B81,C.byref(ok))
  message=C.create_string_buffer(16000);log(shader,16000,None,message)
  results.append({'file':filename,'stage':name,'pass':bool(ok.value),'log':message.value.decode()});stages.append(shader)
 program=cp()
 for shader in stages:attach(program,shader)
 link(program);ok=C.c_int();gp(program,0x8B82,C.byref(ok));message=C.create_string_buffer(16000);lp(program,16000,None,message);results.append({'file':filename,'stage':'link','pass':bool(ok.value),'log':message.value.decode()})
print(json.dumps(results,indent=2));assert all(x['pass'] for x in results)
