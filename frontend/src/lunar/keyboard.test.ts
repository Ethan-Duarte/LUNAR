// @vitest-environment happy-dom
import {it,expect,vi} from 'vitest'
import {timelineKey} from './keyboard'
it('steps within the visible range and pauses without changing study state',()=>{
 const onTime=vi.fn(),onPlay=vi.fn(),actions={time:3600000,playing:true,bounds:[0,7200000] as [number,number],onTime,onPlay,onHelp:vi.fn(),onEscape:vi.fn()};
 timelineKey(new KeyboardEvent('keydown',{key:'ArrowRight',shiftKey:true,cancelable:true}),actions);expect(onTime).toHaveBeenCalledWith(7200000);expect(onPlay).toHaveBeenCalledWith(false);
 timelineKey(new KeyboardEvent('keydown',{key:'Home',cancelable:true}),actions);expect(onTime).toHaveBeenLastCalledWith(0);
})
it('keeps native form/button behavior and ignores repeat toggles',()=>{
 const input=document.createElement('input'),onPlay=vi.fn(),actions={time:0,playing:false,bounds:[0,1] as [number,number],onTime:vi.fn(),onPlay,onHelp:vi.fn(),onEscape:vi.fn()},e=new KeyboardEvent('keydown',{code:'Space',key:' ',cancelable:true});Object.defineProperty(e,'target',{value:input});timelineKey(e,actions);expect(onPlay).not.toHaveBeenCalled();
 timelineKey(new KeyboardEvent('keydown',{code:'Space',key:' ',repeat:true,cancelable:true}),actions);expect(onPlay).not.toHaveBeenCalled();timelineKey(new KeyboardEvent('keydown',{code:'Space',key:' ',cancelable:true}),actions);expect(onPlay).toHaveBeenCalledWith(true);
})
