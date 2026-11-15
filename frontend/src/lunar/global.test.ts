import {it,expect} from 'vitest'
import {readCurrentGlobalDem} from '../lib/testData'
import {globalHeightAt} from '../lib/globalDem'
it('loads the native NASA global grid and handles longitude wrapping / polar samples',()=>{const d=readCurrentGlobalDem();expect(d.width).toBe(5760);expect(d.height).toBe(2880);for(const lat of [-90,-45,0,45,90]){expect(Number.isFinite(globalHeightAt(d,lat,0))).toBe(true);expect(globalHeightAt(d,lat,0)).toBeCloseTo(globalHeightAt(d,lat,360),8)}expect(Math.min(...d.h.slice(0,10000))).toBeGreaterThan(-12000)})
