// Regression for retained selections while scientific datasets are arriving/reloading.
import {createElement} from 'react'
import {renderToString} from 'react-dom/server'
import {it,expect} from 'vitest'
import {useSiteAnalysis} from '../ui/useSiteAnalysis'
import {readEphem,readPolarTerrain,readCurrentGlobalDem} from '../lib/testData'
import type {Ephem} from '../lib/ephem'
import type {Terrain} from '../lib/terrain'
const pin={id:1,slot:0,label:'Retained selection',lat:-89.4399,lon:222.8524,hM:1958}
function Probe({ephem,terrain}:{ephem:Ephem|null;terrain:Terrain|null}){const a=useSiteAnalysis(pin,ephem,terrain,[],terrain?readCurrentGlobalDem():null);return createElement('span',null,a?String(a.summary.commShare):'pending')}
it('retains a selected observer safely when ephemerides or terrain have not arrived',()=>{expect(renderToString(createElement(Probe,{ephem:null,terrain:null}))).toContain('pending');expect(renderToString(createElement(Probe,{ephem:readEphem(),terrain:null}))).toContain('pending')})
it('computes the retained observer when both data dependencies arrive',()=>{const html=renderToString(createElement(Probe,{ephem:readEphem(),terrain:readPolarTerrain()}));expect(html).not.toContain('pending');expect(html).not.toContain('NaN')})
