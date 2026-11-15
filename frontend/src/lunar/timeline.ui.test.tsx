// @vitest-environment happy-dom
import {afterEach,it,expect,vi} from 'vitest'
import {render,screen,fireEvent,cleanup} from '@testing-library/react'
import {TimelineControls} from './TimelineControls'
afterEach(cleanup)
it('supports presets, calendar validation and applying a viewing range',()=>{
 const onTime=vi.fn(),t=Date.parse('2026-11-15T00:00:00Z'),day=86400000;render(<TimelineControls time={t} bounds={[t-100*day,t+100*day]} onTime={onTime}/>);
 fireEvent.click(screen.getByText('Scrub range ▴'));fireEvent.click(screen.getByText('Week'));
 let slider=screen.getByLabelText('Shared timeline') as HTMLInputElement;expect(+slider.max-+slider.min).toBe(7*day);expect(onTime).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('Range start UTC'),{target:{value:'2026-11-16T00:00'}});fireEvent.change(screen.getByLabelText('Range end UTC'),{target:{value:'2026-11-15T00:00'}});fireEvent.click(screen.getByText('Apply scrub range'));expect(screen.getByRole('alert')).toBeTruthy();
 fireEvent.change(screen.getByLabelText('Range end UTC'),{target:{value:'2026-11-17T00:00'}});fireEvent.click(screen.getByText('Apply scrub range'));expect(onTime).toHaveBeenCalledWith(t+day);slider=screen.getByLabelText('Shared timeline') as HTMLInputElement;expect(+slider.max-+slider.min).toBe(day);
})
