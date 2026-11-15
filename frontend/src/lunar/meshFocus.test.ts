import {it,expect} from 'vitest'
import {meshCoordinate} from './meshFocus'
import {lessonCanAdvance} from './baseLesson'
it('refines one continuous domain without adding an overlapping height field',()=>{
 for(const focus of [-9000,0,9000]){
 const points=Array.from({length:401},(_,i)=>meshCoordinate(i/400,-10000,10000,focus));
 expect(points[0]).toBe(-10000);expect(points[400]).toBe(10000);expect(points[200]).toBeCloseTo(focus,8);
 for(let i=1;i<points.length;i++)expect(points[i]).toBeGreaterThanOrEqual(points[i-1]);
 }
 expect(meshCoordinate(.4,-10000,10000,0)-meshCoordinate(.39,-10000,10000,0)).toBeLessThan(200);
 expect(meshCoordinate(.4,-10000,10000,20000)).toBe(-2000);
})
it('requires placed components, an evaluated report and a demonstrated failure and repair',()=>{
 expect(lessonCanAdvance(1,[],null)).toBe(false);expect(lessonCanAdvance(1,[{role:'habitat'}],null)).toBe(true);
 expect(lessonCanAdvance(2,[{role:'habitat'}],null)).toBe(false);expect(lessonCanAdvance(3,[],null)).toBe(false);
 expect(lessonCanAdvance(4,[],{power:{unmetKWh:0}})).toBe(false);expect(lessonCanAdvance(4,[],{power:{unmetKWh:48}})).toBe(true);
 expect(lessonCanAdvance(5,[],{power:{unmetKWh:48}})).toBe(false);expect(lessonCanAdvance(5,[],{power:{unmetKWh:0}})).toBe(true);
})
