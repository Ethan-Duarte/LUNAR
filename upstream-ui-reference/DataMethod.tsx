// LUNAR modification (2026-11-15): branding, workspace integration, settings isolation, display shadows or WebGL fallback. Original Apache-2.0 source: daniel27-space/lunar-navigator; see NOTICE.
// "Data and method": where the numbers come from, how they were checked, which NASA data is
// used and what on screen is generated. One short dialog, reachable from the map's corner card
// and from the Guides and settings menu, so the evidence is never more than one press away.
import { useEffect, useRef } from 'react'
import './DataMethod.css'

const REPO = 'https://github.com/daniel27-space/lunar-navigator/blob/main'

const DATA: [string, string][] = [
  ['South pole terrain, 80 m and 20 m', 'LOLA elevation models, NASA GSFC PGDA product 78'],
  ['Average sunlight, average Earth view, permanent shadow', 'NASA GSFC PGDA product 69 (Mazarico et al. 2011)'],
  ['Sun and Earth positions, Moon orientation', 'JPL DE440 ephemeris, NASA JPL NAIF SPICE kernels'],
  ['Independent check of the angles', 'JPL Horizons'],
  ['Terrain around mission sites', 'SLDEM2015 and LOLA polar grids, NASA PDS LOLA node'],
  ['Whole-Moon colour and elevation', 'LROC WAC and LOLA, NASA Scientific Visualization Studio CGI Moon Kit'],
  ["Earth's surface", 'Blue Marble, NASA Earth Observatory'],
  ['Apollo Lunar Module model', 'NASA 3D Resources'],
  ['Landing and impact coordinates', 'NASA NSSDCA'],
]

export function DataMethod({ onClose }: { onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    close.current?.focus()
    // Heard first (capture) and marked as handled, so one Escape closes this dialog and not also what is under it.
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [onClose])
  return (
    <div className="about-layer" onClick={onClose}>
      <section className="about panel-surface" role="dialog" aria-modal="true" aria-label="Data and method" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Data and method</h2>
          <button ref={close} type="button" className="btn ghost icon" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="about-body">
          <h3 className="section">How the numbers are worked out</h3>
          <ul>
            <li>
              Sun and Earth positions come from JPL's DE440 ephemeris, read with SPICE. The Moon's slow rocking as seen from Earth (libration) is
              included, so Earth moves in the lunar sky as it really does.
            </li>
            <li>The horizon around a point is measured on NASA's LOLA terrain in 720 directions, with the Moon's curvature included.</li>
            <li>
              The Sun and Earth are treated as discs, not points. The Moon has no atmosphere, so light is not bent near the horizon. When Earth
              passes in front of the Sun, the site goes dark.
            </li>
          </ul>
          <h3 className="section">Browser-engine checks (upstream evidence)</h3>
          <ul>
            <li>
              Sun and Earth angles agree with <b>JPL Horizons</b> to better than 0.001° at 6 sites and 8 dates.
            </li>
            <li>
              Over a full 18.6-year cycle at 185 points, the share of time in sunlight matches <b>NASA GSFC's published map</b> (correlation
              0.988, typical difference 2.7 percentage points). Earth visibility matches at 0.993.
            </li>
            <li>On the Shackleton connecting ridge we get 92.29% sunlight at 2 m; Gläser et al. (2014) published 92.27%.</li>
          </ul>
          <p className="caption">
            <a href={`${REPO}/docs/VALIDATION.md`} target="_blank" rel="noreferrer">
              Full validation report, with the disagreements
            </a>
          </p>
          <h3 className="section">LUNAR science and attribution</h3>
          <p>This application directly adapts Daniel27-space’s Lunar Navigator under Apache 2.0. Its renderer, guides, mission catalog and browser analysis are retained and credited. LUNAR adds its independent Python scientific workspace, long-duration studies and evidence ledger.</p>
          <p>LUNAR’s archived independent Earth-map holdout remains <b>FAIL</b>: RMS 3.1668 percentage points against a 3-point limit, and bias +1.0433 against a 1-point limit. Upstream component checks do not validate every LUNAR study.</p>
          <p>Open <b>LUNAR science</b> for exact-observer SPICE studies, assumptions, saved results and exports. Browser cards and Python studies can use different terrain, time windows and criteria; compare only matched configurations.</p>
          <h3 className="section">NASA data used</h3>
          <dl className="about-data">
            {DATA.map(([what, source]) => (
              <div key={what}>
                <dt>{what}</dt>
                <dd>{source}</dd>
              </div>
            ))}
          </dl>
          <p className="caption">
            <a href={`${REPO}/README.md#nasa-data-and-resources`} target="_blank" rel="noreferrer">
              File names, links and picture credits
            </a>
          </p>
          <h3 className="section">What is generated, and use of AI</h3>
          <ul>
            <li>
              In the mission view, Earth's clouds and the ground near each craft are generated by code, not observed. Craft other than the Apollo
              Lunar Module are simplified stand-ins and are labelled so.
            </li>
            <li>No AI-generated images, video or audio are used.</li>
            <li>The upstream project reports Claude Code assistance. LUNAR’s adaptation and integration use OpenAI Codex assistance. Original credit and asset metadata are retained in the distribution.</li>
          </ul>
          <p className="caption">A screening tool, not mission-grade: figures depend on the terrain resolution, the period shown and the assumptions.</p>
        </div>
      </section>
    </div>
  )
}
