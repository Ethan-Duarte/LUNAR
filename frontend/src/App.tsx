// LUNAR interface. Rendering and browser-calculation replacements: V1.8–V1.9.
// Current data and development provenance: NOTICE.
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { invalidate } from "@react-three/fiber";
import {
  loadEphem,
  bodyVectors,
  clockRange,
  ephemEndMs,
  skyAt,
  type Ephem,
} from "./lib/ephem";
import {
  heightAt,
  loadTerrain,
  loadPatchIndex,
  loadPatch,
  patchesCovering,
  type Terrain,
  type HeightSource,
  type PatchIndex,
} from "./lib/terrain";
import { globalHeightAt } from "./lib/globalDem";
import { horizonAt } from "./lib/horizon";
import { sitePosKm, unit } from "./lib/geo";
import { computeSeries, isSunlit, hasComm, eclipseFactor } from "./lib/windows";
import { rankWindows, windowStats } from "./lib/landing";
import { loadFinderGrid, runFinder, type FinderGrid } from "./lib/finder";
import { Globe } from "./scene/Globe";
import { MoonTerrain } from "./scene/MoonTerrain";
import { MoonCanvas } from "./scene/MoonCanvas";
import { LunarCamera as Rig } from "./scene/LunarCamera";
import { MovingDetail } from "./scene/MovingDetail";
import { SkyBodies } from "./scene/SkyBodies";
import { useGlobeMap, useGlobeRelief, type Cut } from "./scene/shading";
import type { Mission } from "./scene/Missions";
import { useStore, DETAIL, type Pin, type LayerMode } from "./store";
import { useSiteAnalysis, type SiteAnalysis } from "./ui/useSiteAnalysis";
import { ScienceWorkspace } from "./lunar/ScienceWorkspace";
import { exportFile } from "./lunar/science";
import { observationProject } from "./lunar/project";
import {InterfaceBoundary} from "./lunar/InterfaceBoundary";
import {ProjectFileInput} from "./lunar/ProjectFileInput";
import {timelineKey} from "./lunar/keyboard";
import {TimelineControls} from "./lunar/TimelineControls";
import {findDaylight} from "./lunar/daylight";
import {sceneTerrainLabel} from "./lunar/historicalLighting";
import {MissionInfoPanel} from "./lunar/MissionInfoPanel";
import {MissionEducation} from "./lunar/MissionEducation";

import { BaseOverlay } from "./lunar/BaseOverlay";
import type { Link } from "./lunar/engineering";
import type { Facility } from "./lunar/network";
import { BasePlanner } from "./lunar/BasePlanner";
import { LunarCompass } from "./lunar/LunarCompass";
import "./lunar/lunar.css";
import "./lunar/v1.css";
const BASE = import.meta.env.BASE_URL + "data/",
  DAY = 86400000;
const pct = (v: number) => (v * 100).toFixed(1) + "%";
const date = (v: number) => new Date(v).toISOString().slice(0, 16);
const cut = (t: Terrain): Cut => ({
  frame: t.frame,
  halfKm: t.levels[0].xMax / 1000,
});
const MissionScene=lazy(()=>import("./lunar/MissionScene").then(m=>({default:m.MissionScene})));
export default function App() {
  const [ephem, setEphem] = useState<Ephem | null>(null),
    [terrain, setTerrain] = useState<Terrain | null>(null),
    [index, setIndex] = useState<PatchIndex | null>(null),
    [patches, setPatches] = useState<Record<string, Terrain>>({}),
    [missions, setMissions] = useState<Mission[]>([]),
    [error, setError] = useState("");
  const [pendingDaylight,setPendingDaylight]=useState<string|null>(null);
  const [missionInfoOpen,setMissionInfoOpen]=useState(true);
  const [sceneMissionId,setSceneMissionId]=useState<string|null>(null);
  const [guideHost,setGuideHost]=useState<HTMLDivElement|null>(null);
  const educationRef=useRef<HTMLDivElement>(null);
  const [daylightNote,setDaylightNote]=useState("");
  const [educationId,setEducationId]=useState<string|null>(null);
  const [tab, setTab] = useState("analyze"),
    [advanced, setAdvanced] = useState(false),
    [hidden, setHidden] = useState(false),
    [help, setHelp] = useState(false),
    [lat, setLat] = useState(-89.4399),
    [lon, setLon] = useState(222.8524),
    [finderGrid, setFinderGrid] = useState<FinderGrid | null>(null),
    [finderError, setFinderError] = useState("");
  const [baseFacilities, setBaseFacilities] = useState<Facility[]>([]);
  const [baseLinks,setBaseLinks]=useState<Link[]>([]);
  const basePick = useRef<
    ((lat: number, lon: number, id?: string) => void) | null
  >(null);
  const registerBasePick = useCallback(
    (fn: (lat: number, lon: number, id?: string) => void) => {
      basePick.current = fn;
    },
    [],
  );
  const pins = useStore((s) => s.pins),
    activeId = useStore((s) => s.activePin),
    t = useStore((s) => s.tMs),
    playing = useStore((s) => s.playing),
    quality = useStore((s) => s.quality),
    layer = useStore((s) => s.layer),
    observer = useStore((s) => s.observerM),
    criteria = useStore((s) => s.criteria),
    windowStart = useStore((s) => s.windowStart),
    view = useStore((s) => s.view.kind),
    fill = useStore((s) => s.shadowFill),
    finder = useStore((s) => s.finder);
  const map = useGlobeMap(BASE),
    { relief } = useGlobeRelief(BASE),
    detail = DETAIL[quality];
  useEffect(() => {
    let live = true;
    const fail = (label: string) => (e: Error) => {
      if (live) setError(label + ": " + e.message);
    };
    loadEphem(BASE).then((v) => {
      if (live) {
        setEphem(v);
        useStore.getState().setTimeRange(clockRange(v));
      }
    }, fail("Ephemeris"));
    loadTerrain(BASE).then((v) => {
      if (live) setTerrain(v);
    }, fail("Terrain"));
    loadPatchIndex(BASE).then((v) => {
      if (live) setIndex(v);
    }, fail("Site terrain index"));
    fetch(BASE + "missions.json")
      .then((r) => r.json())
      .then((v) => {
        if (live) setMissions(v);
      }, fail("Site catalog"));
    useStore.getState().setWelcome(false);
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!playing || !ephem) return;
    let id = 0,
      last = performance.now();
    const tick = (now: number) => {
      const s = useStore.getState(),
        next = s.tMs + (now - last) * s.rate;
      last = now;
      s.setTime(next);
      if (next >= clockRange(ephem)[1]) s.setPlaying(false);
      else id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing, ephem]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(!ephem)return;const state=useStore.getState(),slider=document.querySelector<HTMLInputElement>('input[aria-label="Shared timeline"]'),bounds:[number,number]=slider?[+slider.min,+slider.max]:clockRange(ephem);timelineKey(e,{time:state.tMs,playing:state.playing,bounds,onTime:state.setTime,onPlay:state.setPlaying,onHelp:()=>setHelp(v=>!v),onEscape:()=>{setHelp(false);setMissionInfoOpen(false);window.dispatchEvent(new Event('lunar-cancel-placement'))}})};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[ephem]);
  const wanted = useMemo(
    () =>
      index
        ? Array.from(
            new Set(
              [...pins, ...baseFacilities].flatMap((p) =>
                patchesCovering(index, p.lat, p.lon).map((p) => p.id),
              ),
            ),
          )
        : [],
    [index, pins, baseFacilities],
  );
  const pending = useRef(new Set<string>());
  useEffect(() => {
    if (!index) return;
    for (const id of wanted) {
      if (patches[id] || pending.current.has(id)) continue;
      pending.current.add(id);
      loadPatch(
        BASE,
        index,
        index.patches.find((p) => p.id === id)!,
      )
        .then(
          (v) => setPatches((p) => ({ ...p, [id]: v })),
          (e) => setError("Local terrain: " + e.message),
        )
        .finally(() => pending.current.delete(id));
    }
  }, [wanted, index, patches]);
  const patchOf = useCallback(
    (a: number, b: number) =>
      index
        ? patchesCovering(index, a, b)
            .map((p) => patches[p.id])
            .filter((v): v is Terrain => !!v)
        : [],
    [index, patches],
  );
  const sourceOf = useCallback(
    (a: number, b: number): HeightSource => ({
      terrains: [...patchOf(a, b), ...(terrain ? [terrain] : [])],
      global: relief?.dem ?? null,
    }),
    [patchOf, terrain, relief],
  );
  const elevation = useCallback(
    (a: number, b: number) => {
      for (const tile of sourceOf(a, b).terrains) {
        const h = heightAt(tile, a, b);
        if (Number.isFinite(h)) return h;
      }
      return relief ? globalHeightAt(relief.dem, a, b) : 0;
    },
    [sourceOf, relief],
  );
  function pin(a: number, b: number, label = "Observation point") {
    if (!ready) {
      setError("Terrain and ephemerides are still loading.");
      return;
    }
    if (!Number.isFinite(a + b) || a < -90 || a > 90) {
      setError("Latitude must be −90° to 90°; coordinates must be finite.");
      return;
    }
    const s = useStore.getState();
    s.addPin({
      lat: a,
      lon: ((((b + 180) % 360) + 360) % 360) - 180,
      hM: elevation(a, b),
      label,
    });
    setError("");
    // Location selection preserves the current workspace.
  }
  function locate(a: number, b: number, label?: string) {
    pin(a, b, label);
    useStore
      .getState()
      .goTo({ kind: "site", lat: a, lon: b, hM: elevation(a, b) });
  }
  const a = useSiteAnalysis(
    pins[0] ?? null,
    ephem,
    terrain,
    patchOf(pins[0]?.lat ?? 0, pins[0]?.lon ?? 0),
    relief?.dem ?? null,
  );
  const b = useSiteAnalysis(
    pins[1] ?? null,
    ephem,
    terrain,
    patchOf(pins[1]?.lat ?? 0, pins[1]?.lon ?? 0),
    relief?.dem ?? null,
  );
  const c = useSiteAnalysis(
    pins[2] ?? null,
    ephem,
    terrain,
    patchOf(pins[2]?.lat ?? 0, pins[2]?.lon ?? 0),
    relief?.dem ?? null,
  );
  const analyses = [a, b, c].filter((v): v is SiteAnalysis => !!v),
    active = analyses.find((a) => a.pin.id === activeId) ?? analyses.at(-1);
  const sceneMission=missions.find(m=>m.id===sceneMissionId);
  const sceneSource=useMemo(()=>sceneMission?sourceOf(sceneMission.lat,sceneMission.lon):null,[sceneMission,sourceOf]);
  useEffect(()=>{if(tab!=="sites")setSceneMissionId(null)},[tab]);
  useEffect(()=>setDaylightNote(""),[active?.pin.id]);
  function findObserverDaylight(){if(!active||!ephem)return;const next=findDaylight(ephem,active.horizon,active.hM,t);if(next===null){setDaylightNote("No fully clear solar-disc sample found in the next 60 days within the ephemerides.");return}useStore.getState().setPlaying(false);useStore.getState().setTime(next);setDaylightNote(active.pin.label+" daylight sample: "+date(next).replace("T"," ")+" UTC. Hourly search; study dates unchanged.")}
  useEffect(()=>{if(!pendingDaylight||!active||!ephem)return;const m=missions.find(m=>m.id===pendingDaylight);if(m&&Math.abs(active.pin.lat-m.lat)<1e-6&&Math.abs(((active.pin.lon-m.lon+540)%360)-180)<1e-6){setPendingDaylight(null);findObserverDaylight()}},[pendingDaylight,active,ephem]);
  const bodies = ephem ? bodyVectors(ephem, t) : null;
  const shown = wanted.map(id=>patches[id]).filter((v):v is Terrain=>!!v&&v.render!==false);
  const surfaceFocus = active && (view === "site" || view === "approach") ? {lat:active.pin.lat,lon:active.pin.lon} : undefined;
  useEffect(() => {
    invalidate();
  });
  useEffect(() => {
    if (tab === "find" && !finderGrid)
      loadFinderGrid(BASE).then(setFinderGrid, (e) =>
        setFinderError(e.message),
      );
  }, [tab, finderGrid]);
  const found = useMemo(
    () => (finderGrid ? runFinder(finderGrid, finder) : null),
    [finderGrid, finder],
  );
  const year = useMemo(
    () =>
      active && ephem
        ? computeSeries(
            ephem,
            active.horizon,
            active.hM,
            windowStart,
            Math.min(windowStart + 365 * DAY, ephemEndMs(ephem)),
            3600000,
          )
        : null,
    [active?.horizon, active?.hM, ephem, windowStart],
  );
  const [stay, setStay] = useState(14),
    [baseline, setBaseline] = useState<number | null>(null);
  const ranked = useMemo(
    () =>
      year
        ? rankWindows(
            year,
            stay,
            { sunHigh: true, earthHigh: true },
            { top: 3, criteria },
          )
        : [],
    [year, stay, criteria],
  );
  const selectedStay = year
      ? windowStats(year, Math.round(t / 3600000) * 3600000, stay, criteria)
      : null,
    baseStay =
      year && baseline !== null
        ? windowStats(year, baseline, stay, criteria)
        : null;
  const ready = !!ephem && !!terrain && !!relief;
  function save() {
    exportFile(
      "LUNAR-project.json",
      JSON.stringify(
        {
          schema: "lunar-project-1",
          version: "1.9.1-experiment",
          pins,
          time: t,
          observer,
          criteria,
          quality,
          layer,
        },
        null,
        2,
      ),
    );
  }
  async function restore(file: File) {
    try {
      if (!ready)
        throw Error(
          "Wait for terrain and ephemerides before opening a project",
        );
      const j = observationProject(JSON.parse(await file.text()));
      const s = useStore.getState();
      for (const p of s.pins) s.removePin(p.id);
      for (const p of j.pins)
        s.addPin({
          lat: p.lat,
          lon: p.lon,
          hM: elevation(p.lat, p.lon),
          label: String(p.label).slice(0, 80),
        });
      if (Number.isFinite(j.observer) && j.observer >= 0 && j.observer <= 100)
        s.setAssumptions({ observerM: j.observer });
      s.setAssumptions(j.criteria);
      s.setQuality(j.quality);
      s.setLayer(j.layer);
      s.setPlaying(false);
      s.setTime(j.time);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Project could not be opened");
    }
  }
  return (
    <div
      className="lunar-app"
      data-advanced={advanced}
      data-panel={hidden ? "hidden" : "shown"}
    >
      <header className="v1-header">
        <a className="v1-brand" href="#" onClick={(e) => e.preventDefault()}>
          <span className="brand-orbit" />
          LUNAR <small>FIELD ATLAS / 1.9.1</small>
        </a>
        <div className="v1-header-right">
          <span className="v1-live">
            {ready
              ? "Measured terrain · JPL ephemerides"
              : "Loading scientific data…"}
          </span>
          <div className="v1-segment" aria-label="Interface detail">
            {[false, true].map((v) => (
              <button
                key={String(v)}
                aria-pressed={advanced === v}
                onClick={() => {
                  setAdvanced(v);
                  if (!v && !["analyze", "sites"].includes(tab))
                    setTab("analyze");
                  useStore.getState().setMode(v ? "plan" : "explore");
                }}
              >
                {v ? "Advanced" : "Basic"}
              </button>
            ))}
          </div>
          <button
            className="v1-icon"
            onClick={() => setHelp(!help)}
            aria-label="Open LUNAR field guide"
          >
            ?
          </button>
        </div>
      </header>
      <main className="v1-main">
        <aside className="v1-aside">
          <nav className="v1-nav" aria-label="Workspace">
            {[
              ["analyze", "Observe"],
              ["find", "Find"],
              ["compare", "Compare"],
              ["base", "Base"],
              ["sites", "Sites"],
            ]
              .filter(([id]) => advanced || id === "analyze" || id === "sites")
              .map(([id, name]) => (
                <button
                  key={id}
                  aria-pressed={tab === id}
                  onClick={() => setTab(id)}
                >
                  {name}
                </button>
              ))}
          </nav>
          <div className="v1-science-entry" hidden={!advanced}>
            <ScienceWorkspace onLocate={(s) => locate(s.lat, s.lon, s.name)} />
          </div>
          <div className="v1-scroll">
            {error && (
              <div className="v1-alert" role="alert">
                {error}
                <button onClick={() => setError("")}>Dismiss</button>
              </div>
            )}
            {tab === "analyze" && (
              <><p className="v1-note">Analysis period starts {date(windowStart).replace("T"," ")} UTC. <button onClick={()=>useStore.getState().setWindowStart(t)}>Start analysis at viewing time</button></p>
                <p className="v1-eyebrow">A POINT ON THE MOON</p>
                <h1>At the edge of light.</h1>
                <p className="v1-intro">
                  Read the sky from a fixed observer. Move freely through the
                  terrain; the calculation stays with the marker.
                </p>
                <div className="v1-fields">
                  <label>
                    Latitude °
                    <input
                      aria-label="Latitude"
                      type="number"
                      value={lat}
                      onChange={(e) => setLat(+e.target.value)}
                    />
                  </label>
                  <label>
                    Longitude east °
                    <input
                      aria-label="Longitude"
                      type="number"
                      value={lon}
                      onChange={(e) => setLon(+e.target.value)}
                    />
                  </label>
                </div>
                <button
                  className="v1-primary"
                  disabled={!ready}
                  onClick={() => locate(lat, lon)}
                >
                  Place an observer ↗
                </button>
                {!pins.length && (
                  <button
                    className="v1-link"
                    disabled={!ready}
                    onClick={() =>
                      locate(-89.4399, 222.8524, "Connecting Ridge")
                    }
                  >
                    Begin at Connecting Ridge
                  </button>
                )}
                <div className="v1-pin-list">
                  {analyses.map((q) => (
                    <button
                      key={q.pin.id}
                      className={q === active ? "selected" : ""}
                      onClick={() => useStore.getState().setActivePin(q.pin.id)}
                    >
                      {q.pin.label}
                      <span>
                        {q.pin.lat.toFixed(3)}°, {q.pin.lon.toFixed(3)}°
                      </span>
                    </button>
                  ))}
                </div>
                {active && (
                  <>
                    <div className="v1-reading">
                      <span>
                        SUN{" "}
                        <b>
                          {active.sunFrac >= criteria.minSunFrac
                            ? "AVAILABLE"
                            : "OBSTRUCTED"}
                        </b>
                      </span>
                      <strong>{active.sky.sun.el.toFixed(2)}°</strong>
                      <small>
                        altitude ·{" "}
                        {active.eclipse < 0.99
                          ? "Earth occultation contributes"
                          : "terrain-tested disc visibility"}
                      </small>
                    </div>
                    <div className="v1-reading earth">
                      <span>
                        EARTH{" "}
                        <b>
                          {active.earthClear >= criteria.earthMaskDeg
                            ? "ABOVE MASK"
                            : "BELOW MASK"}
                        </b>
                      </span>
                      <strong>{active.earthClear.toFixed(2)}°</strong>
                      <small>centre clearance above the measured skyline</small>
                    </div>
                    <Metrics a={active} />
                    <Availability a={active} />
                    <details className="v1-detail">
                      <summary>Why is the view blocked?</summary>
                      <p>
                        At the Sun’s azimuth ({active.sky.sun.az.toFixed(1)}°),
                        the terrain horizon is{" "}
                        {horizonAt(active.horizon, active.sky.sun.az).toFixed(
                          2,
                        )}
                        °. Earth is at azimuth {active.sky.earth.az.toFixed(1)}
                        °. Clearance is measured from this skyline, not the
                        camera’s skyline.
                      </p>
                      <Horizon a={active} />
                      <p className="v1-note">
                        {active.tier} terrain chain · {observer} m observer ·
                        numerical detail does not establish physical accuracy.
                      </p>
                    </details>
                    <button
                      className="v1-link"
                      onClick={() => {
                        useStore.getState().removePin(active.pin.id);
                      }}
                    >
                      Remove this observer
                    </button>
                  </>
                )}
                {advanced && (
                  <>
                    <Assumptions />
                  </>
                )}
                <div className="v1-project">
                  <button onClick={save}>Save project ↓</button>
                  <ProjectFileInput label="Open project" onOpen={restore}/>
                </div>
              </>
            )}
            {tab === "find" && (
              <>
                <p className="v1-eyebrow">REQUIREMENTS FIRST</p>
                <h1>Find useful ground.</h1>
                <p>
                  Search the mapped south-polar region using long-term NASA
                  layers. This shortlist is separate from a date-specific study.
                </p>
                <div className="v1-fields">
                  <label>
                    Maximum slope °
                    <input
                      type="number"
                      value={finder.maxSlopeDeg}
                      onChange={(e) =>
                        useStore.getState().setFinder({
                          maxSlopeDeg: Math.max(0, +e.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    Minimum Sun fraction
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step=".05"
                      value={finder.sunMin}
                      onChange={(e) =>
                        useStore.getState().setFinder({
                          sunMin: Math.max(0, Math.min(1, +e.target.value)),
                        })
                      }
                    />
                  </label>
                  <label>
                    Minimum Earth fraction
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step=".05"
                      value={finder.earthMin}
                      onChange={(e) =>
                        useStore.getState().setFinder({
                          earthMin: Math.max(0, Math.min(1, +e.target.value)),
                        })
                      }
                    />
                  </label>
                  <label>
                    Maximum distance to shadow km
                    <input
                      type="number"
                      min="0"
                      value={finder.maxPsrKm ?? ""}
                      placeholder="Unrestricted"
                      onChange={(e) =>
                        useStore.getState().setFinder({
                          maxPsrKm:
                            e.target.value === ""
                              ? null
                              : Math.max(0, +e.target.value),
                        })
                      }
                    />
                  </label>
                </div>
                {finderError && <p role="alert">{finderError}</p>}
                {found ? (
                  <>
                    <p className="v1-note">
                      {found.candidates.length} shortlisted locations.
                      Suitability is a weighted screening score, not a
                      landing-safety verdict.
                    </p>
                    {found.candidates.map((q) => (
                      <button
                        className="v1-result"
                        key={q.rank}
                        onClick={() =>
                          locate(q.lat, q.lon, "Candidate " + q.rank)
                        }
                      >
                        <b>
                          {String(q.rank).padStart(2, "0")} / {q.lat.toFixed(3)}
                          °, {q.lon.toFixed(3)}°
                        </b>
                        <span>
                          Sun {pct(q.sun)} · Earth {pct(q.earth)} · slope{" "}
                          {q.slopeDeg.toFixed(1)}°
                        </span>
                      </button>
                    ))}
                    {!found.candidates.length && (
                      <p className="v1-alert">
                        No locations meet all current requirements. Inspect or
                        relax one constraint at a time; requirements are never
                        silently changed.
                      </p>
                    )}
                  </>
                ) : (
                  <p>Loading published suitability layers…</p>
                )}
              </>
            )}
            {tab === "compare" && (
              <>
                <p className="v1-eyebrow">SAME TIME. SAME ASSUMPTIONS.</p>
                <h1>Make the tradeoff visible.</h1>
                {analyses.length < 2 ? (
                  <p>
                    Place two or three observers from Observe, Find, or Sites.
                    Their availability will be compared over the same 60-day
                    window.
                  </p>
                ) : (
                  <>
                    <table className="v1-table">
                      <thead>
                        <tr>
                          <th>Location</th>
                          <th>Sun</th>
                          <th>Earth</th>
                          <th>Darkness</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analyses.map((q) => (
                          <tr key={q.pin.id}>
                            <td>{q.pin.label}</td>
                            <td>{pct(q.summary.sunShare)}</td>
                            <td>{pct(q.summary.commShare)}</td>
                            <td>
                              {(q.summary.longestDarkH / 24).toFixed(2)} d
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p>
                      No universal winner is assumed. More sunlight, shorter
                      darkness and shorter infrastructure can favor different
                      locations.
                    </p>
                    <button
                      className="v1-link"
                      onClick={() =>
                        exportFile(
                          "LUNAR-comparison.json",
                          JSON.stringify(
                            {
                              criteria,
                              observer,
                              period: [windowStart, windowStart + 60 * DAY],
                              sites: analyses.map((q) => ({
                                site: q.pin,
                                summary: q.summary,
                                tier: q.tier,
                              })),
                            },
                            null,
                            2,
                          ),
                        )
                      }
                    >
                      Export matched comparison ↓
                    </button>
                  </>
                )}
                {active && year && (
                  <>
                    <h2>Arrival and schedule slips</h2>
                    <p className="v1-note">
                      One-year search · hourly sampling · ranking: 60% Sun, 40%
                      Earth availability.
                    </p>
                    <label className="v1-label">
                      Stay length
                      <select
                        value={stay}
                        onChange={(e) => setStay(+e.target.value)}
                      >
                        {[7, 14, 30].map((v) => (
                          <option key={v} value={v}>
                            {v} days
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      onClick={() =>
                        setBaseline(Math.round(t / 3600000) * 3600000)
                      }
                    >
                      Keep current arrival as baseline
                    </button>
                    {baseline !== null && (
                      <div className="v1-slip">
                        {[7, 14, 30].map((v) => (
                          <button
                            key={v}
                            onClick={() => {
                              const s = useStore.getState();
                              s.setPlaying(false);
                              s.setTime(baseline + v * DAY);
                            }}
                          >
                            +{v} days
                          </button>
                        ))}
                      </div>
                    )}
                    {baseStay && selectedStay && (
                      <p>
                        Against baseline: Sun{" "}
                        {(
                          100 *
                          (selectedStay.sunShare - baseStay.sunShare)
                        ).toFixed(1)}{" "}
                        percentage points; Earth{" "}
                        {(
                          100 *
                          (selectedStay.commShare - baseStay.commShare)
                        ).toFixed(1)}{" "}
                        points.
                      </p>
                    )}
                    {ranked.map((q, i) => (
                      <button
                        className="v1-result"
                        key={i}
                        onClick={() => {
                          useStore.getState().setPlaying(false);
                          useStore.getState().setTime(q.stats.startMs);
                        }}
                      >
                        <b>{date(q.stats.startMs).replace("T", " ")} UTC</b>
                        <span>
                          Sun {pct(q.stats.sunShare)} · Earth{" "}
                          {pct(q.stats.commShare)}
                        </span>
                      </button>
                    ))}
                  </>
                )}
              </>
            )}
            <div hidden={tab !== "base"}>
              <BasePlanner
                guideHost={tab==="base"?guideHost:null}
                onRevealGuide={()=>setHidden(false)}
                active={active}
                ready={ready}
                sourceOf={sourceOf}
                ephem={ephem}
                windowStart={windowStart}
                advanced={advanced}
                onLocate={locate}
                onLayout={setBaseFacilities}
                onLinks={setBaseLinks}
                onPlaceReady={registerBasePick}
              />
            </div>
            {tab === "sites" && (
              <>
                <p className="v1-eyebrow">
                  A REFERENCE LIBRARY, NOT A RECOMMENDATION
                </p>
                <h1>Explore the Moon’s history.</h1>
                <p>
                  Historical coordinates and announced target regions. Proposed
                  locations are approximate and reflect the supplied catalog,
                  not live mission updates.
                </p>
                <p className="v1-note">
                  Viewing a historical site keeps the current simulation date.
                  The catalog’s landing date is historical context, not a replay
                  of that mission.
                </p>
                <div ref={educationRef}>{educationId&&<p className="v1-note">The selected mission’s information is beside the viewer. <button onClick={()=>setMissionInfoOpen(true)}>Open mission info</button></p>}</div>
                {[
                  ["landed", "Historical landings"],
                  ["crashed", "Landing attempts"],
                  ["planned", "Announced target regions"],
                ].map(([status, title]) => (
                  <details key={status} className="v1-detail">
                    <summary>{title}</summary>
                    {missions
                      .filter((m) => m.status === status)
                      .map((m) => (
                        <article key={m.id} className="v1-site">
                          <h3>{m.name}</h3>
                          <p>
                            {m.agency} · {m.date_utc.slice(0, 10)} ·{" "}
                            {m.lat.toFixed(3)}°, {m.lon.toFixed(3)}°
                          </p>
                          <div>
                            <button
                              disabled={!ready}
                              onClick={() => {setEducationId(m.id);setMissionInfoOpen(true);setSceneMissionId(m.status==="landed"?m.id:null);locate(m.lat, m.lon, m.name);requestAnimationFrame(()=>educationRef.current?.scrollIntoView?.({behavior:"smooth",block:"start"}))}}
                            >
                              Study this location ↗
                            </button>
                            <a
                              href={m.source_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Coordinate source
                            </a>
                          </div>
                        </article>
                      ))}
                  </details>
                ))}
              </>
            )}
          </div>
        </aside>
        <section className="v1-scene" data-mission-info={tab==="sites"&&educationId&&missionInfoOpen?"open":"closed"} aria-label="Lunar terrain observatory">
          <div className="v1-scene-tools">
            <div className="v1-segment">
              <button
                onClick={() => {setSceneMissionId(null);useStore.getState().goTo({ kind: "globe" })}}
                aria-pressed={view === "globe"}
              >
                Globe
              </button>
              <button
                onClick={() => {setSceneMissionId(null);useStore.getState().goTo({ kind: "pole" })}}
                aria-pressed={view === "pole"}
              >
                South pole
              </button>
              {active && (
                <button
                  onClick={() => {setSceneMissionId(null);
                    useStore.getState().goTo({
                      kind: "approach",
                      lat: active.pin.lat,
                      lon: active.pin.lon,
                      hM: active.hM,
                    })}
                  }
                >
                  Surface
                </button>
              )}
            </div>
            <button onClick={() => setHidden(!hidden)}>
              {hidden ? "Show analysis" : "Hide analysis"}
            </button>
          </div>
          {sceneMission&&sceneSource&&<InterfaceBoundary label="Mission scene"><Suspense fallback={<div className="mission-scene">Loading expedition scene…</div>}><MissionScene key={sceneMission.id} mission={sceneMission} source={sceneSource} dataBase={BASE} quality={quality} sunDirection={bodies?unit(bodies.sun):undefined} map={map} relief={relief} horizon={active&&Math.abs(active.pin.lat-sceneMission.lat)<1e-6&&Math.abs(((active.pin.lon-sceneMission.lon+540)%360)-180)<1e-6?active.horizon:undefined} eclipse={ephem?eclipseFactor(skyAt(ephem,t,sceneMission.lat,sceneMission.lon,elevation(sceneMission.lat,sceneMission.lon))):1} sun={ephem?skyAt(ephem,t,sceneMission.lat,sceneMission.lon,elevation(sceneMission.lat,sceneMission.lon)).sun:undefined} onClose={()=>setSceneMissionId(null)}/></Suspense></InterfaceBoundary>}
          {tab==="sites"&&missions.find(m=>m.id===educationId)&&<MissionInfoPanel mission={missions.find(m=>m.id===educationId)!} open={missionInfoOpen} onToggle={()=>setMissionInfoOpen(v=>!v)} onBrowse={()=>{setHidden(false);requestAnimationFrame(()=>educationRef.current?.scrollIntoView?.({behavior:"smooth",block:"start"}))}} onDaylight={()=>{const m=missions.find(m=>m.id===educationId)!;if(!active||Math.abs(active.pin.lat-m.lat)>1e-6||Math.abs(((active.pin.lon-m.lon+540)%360)-180)>1e-6){locate(m.lat,m.lon,m.name);setPendingDaylight(m.id);return}findObserverDaylight()}}><MissionEducation key={educationId} mission={missions.find(m=>m.id===educationId)!} terrainLabel={sceneSource?sceneTerrainLabel(sceneSource,missions.find(m=>m.id===educationId)!.lat,missions.find(m=>m.id===educationId)!.lon):undefined} timeLabel={date(t).replace('T',' ')} onScene={()=>{const m=missions.find(m=>m.id===educationId)!;locate(m.lat,m.lon,m.name);setSceneMissionId(educationId)}} onStudy={()=>{setSceneMissionId(null);const m=missions.find(m=>m.id===educationId)!;locate(m.lat,m.lon,m.name)}} onSurface={()=>{setSceneMissionId(null);const m=missions.find(m=>m.id===educationId)!;locate(m.lat,m.lon,m.name);useStore.getState().goTo({kind:'approach',lat:m.lat,lon:m.lon,hM:elevation(m.lat,m.lon)})}}/></MissionInfoPanel>}
          <div className="viewer-guide-host" ref={setGuideHost}/>
          <div className="viewer-daylight"><button id="find-observer-daylight" disabled={!active||!ephem} onClick={findObserverDaylight}>Find daylight</button>{daylightNote&&<p role="status">{daylightNote}</p>}</div>
          <div className="v1-bearings" style={{display:sceneMission?"none":undefined}}>
            {["sun", "earth"].map((name) => (
              <span
                id={"lunar-bearing-" + name}
                className={"v1-bearing " + name}
                key={name}
                data-show="false"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M3 10h13M11 4l6 6-6 6" />
                </svg>
                {name.toUpperCase()}
              </span>
            ))}
          </div>
          <div className="v1-canvas">
            {!sceneMission&&<InterfaceBoundary label="3D view"><MoonCanvas quality={quality}>
              <color attach="background" args={["#03060b"]} />
              <Globe
                sunDir={unit(bodies?.sun ?? [1, 0, 0])}
                cuts={[
                  ...(terrain ? [cut(terrain)] : []),
                  ...shown.map(cut),
                ]}
                map={map}
                relief={relief}
                segments={detail.globe}
                onPick={(a, b) =>
                  tab === "base" ? basePick.current?.(a, b) : pin(a, b)
                }
              />
              {terrain && (
                <MoonTerrain
                  terrain={terrain}
                  sunDir={unit(bodies?.sun ?? [1, 0, 0])}
                  sunRad={Math.asin(
                    695700 / (bodies ? Math.hypot(...bodies.sun) : 149600000),
                  )}
                  layer={layer}
                  dataBase={BASE}
                  map={map}
                  relief={relief}
                  overlays
                  focus={surfaceFocus}
                  detail={detail}
                  cuts={shown.map(cut)}
                  onPick={(a, b) =>
                    tab === "base" ? basePick.current?.(a, b) : pin(a, b)
                  }
                />
              )}{" "}
              {shown.map((tile) => (
                <MoonTerrain
                  key={tile.id}
                  terrain={tile}
                  sunDir={unit(bodies?.sun ?? [1, 0, 0])}
                  sunRad={0.0047}
                  layer={layer}
                  dataBase={BASE}
                  map={map}
                  relief={relief}
                  overlays={false}
                  detail={detail}
                  focus={surfaceFocus}
                  onPick={(a, b) =>
                    tab === "base" ? basePick.current?.(a, b) : pin(a, b)
                  }
                />
              ))}
              {bodies && (
                <SkyBodies sun={bodies.sun} earth={bodies.earth} tMs={t} />
              )}
              {tab === "base" && (
                <BaseOverlay
                  facilities={baseFacilities}
                  links={baseLinks}
                  elevation={elevation}
                  onSelect={(id) => basePick.current?.(0, 0, id)}
                />
              )}
              <Markers pins={pins} elevation={elevation} />
              <Rig elevation={elevation} />
              <MovingDetail />
              {bodies && <LunarCompass sun={bodies.sun} earth={bodies.earth} />}
            </MoonCanvas></InterfaceBoundary>}
          </div>
          <div className="v1-scene-bottom" style={{display:sceneMission?"none":undefined}}>
            <span>
              {active
                ? active.pin.label +
                  " · " +
                  {
                    crest: "20 m patch",
                    patch: "local grid",
                    fine: "80 m polar",
                    coarse: "coarse polar",
                    global: "1.90 km global",
                    none: "no detailed data",
                  }[active.tier]
                : "Choose a point on the measured surface"}
              <small>DISPLAY SKY SIZES ENLARGED · TIMELINE AT OBSERVER</small>
            </span>
            <div className="v1-display">
              <select
                aria-label="Map layer"
                value={layer}
                onChange={(e) =>
                  useStore.getState().setLayer(e.target.value as LayerMode)
                }
              >
                {[
                  ["natural", "Sunlight now"],
                  ["elevation", "Elevation"],
                  ["slope", "Slope"],
                  ["sunavg", "Polar average sunlight"],
                  ["earthavg", "Polar Earth view"],
                  ["psr", "Permanent shadow"],
                ].map(([v, n]) => (
                  <option value={v} key={v}>
                    {n}
                  </option>
                ))}
              </select>
              <button
                aria-pressed={fill < 0.01}
                onClick={() =>
                  useStore.getState().setShadowFill(fill < 0.01 ? 0.03 : 0.0015)
                }
              >
                {fill < 0.01 ? "Deep shadows" : "Inspect shadows"}
              </button>
              <select
                aria-label="Rendering detail"
                value={quality}
                onChange={(e) =>
                  useStore
                    .getState()
                    .setQuality(e.target.value as "low" | "medium" | "high")
                }
              >
                {["low", "medium", "high"].map((v) => (
                  <option key={v} value={v}>
                    {v} detail
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>
      </main>
      <footer className="v1-time">
        <button
          aria-label={playing ? "Pause" : "Play"}
          disabled={!ephem}
          onClick={() => useStore.getState().setPlaying(!playing)}
        >
          {playing ? "Ⅱ" : "▶"}
        </button>
        <input
          aria-label="Simulation UTC"
          type="datetime-local"
          value={date(t)}
          onChange={(e) => {
            const v = Date.parse(e.target.value + "Z");
            if (Number.isFinite(v)) {
              useStore.getState().setPlaying(false);
              useStore.getState().setTime(v);
            }
          }}
        />
        <TimelineControls time={t} bounds={ephem?clockRange(ephem):[t-86400000,t+86400000]} onTime={v=>{useStore.getState().setPlaying(false);useStore.getState().setTime(v)}}/>
        <select
          aria-label="Playback speed"
          value={useStore((s) => s.rate)}
          onChange={(e) => useStore.getState().setRate(+e.target.value)}
        >
          {[3600, 21600, 86400, 604800].map((v, i) => (
            <option key={v} value={v}>
              {["1 hour", "6 hours", "1 day", "7 days"][i]} / s
            </option>
          ))}
        </select>
        <span>UTC</span>
      </footer>
      {help && (
        <div className="v1-help" role="dialog" aria-label="LUNAR field guide">
          <button onClick={() => setHelp(false)} aria-label="Close guide">
            ×
          </button>
          <p className="v1-eyebrow">FIELD NOTES / LUNAR</p>
          <h2>Find the relationship, not just the place.</h2><p>Space: play/pause · ←/→: 10 minutes · Shift + arrows: 1 hour · Home/End: scrub-range boundaries · Escape: close/cancel · ?: help. Shortcuts leave forms and focused controls alone.</p>
          {[
            [
              "Observe",
              "Place a fixed observer. The terrain camera can move independently; the sky and timeline still belong to the marked point.",
            ],
            [
              "Find",
              "Turn mission requirements into a shortlist. Published long-term maps are useful context, not the same experiment as a dated study.",
            ],
            [
              "Compare",
              "Use the same time and assumptions to weigh locations, arrival dates and schedule changes.",
            ],
            [
              "Base",
              "Assign facilities to locations. Size solar arrays and storage, test eclipse losses and geometric tower links, and compare nearby layouts under explicit constraints.",
            ],
            [
              "Advanced",
              "Change physical criteria and open the retained Python workspace. Validation reports distinguish passed component checks from unresolved discrepancies.",
            ],
          ].map(([h, p]) => (
            <article key={h}>
              <h3>{h}</h3>
              <p>{p}</p>
            </article>
          ))}
          <p className="v1-note">
            Screening, not mission certification. Independent Earth-map holdout
            remains FAIL. Archived Python studies omit eclipses; new V1 Python
            calculations include a documented approximate combined model. Code
            attribution and data sources:{" "}
            <a href="lunar/evidence/NOTICE" target="_blank">
              credits
            </a>
            .
          </p>
        </div>
      )}
    </div>
  );
}
function Metrics({ a }: { a: SiteAnalysis }) {
  return (
    <div className="v1-metrics">
      {[
        ["Sun", pct(a.summary.sunShare)],
        ["Earth", pct(a.summary.commShare)],
        ["Longest dark", (a.summary.longestDarkH / 24).toFixed(2) + " d"],
      ].map(([k, v]) => (
        <div key={k}>
          <small>{k}</small>
          <strong>{v}</strong>
        </div>
      ))}
      <p>60 days from {date(a.series.t0Ms).slice(0, 10)} · shared criteria</p>
    </div>
  );
}
function Availability({ a }: { a: SiteAnalysis }) {
  const criteria = useStore((s) => s.criteria);
  return (
    <div className="v1-bands">
      {(["Sun", "Earth"] as const).map((body) => (
        <div key={body}>
          <small>{body}</small>
          <svg
            viewBox={`0 0 ${a.series.count} 14`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`${body} availability over 60 days`}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              useStore.getState().setPlaying(false);
              useStore
                .getState()
                .setTime(
                  a.series.t0Ms +
                    ((e.clientX - r.left) / r.width) *
                      (a.series.count - 1) *
                      a.series.stepMs,
                );
            }}
          >
            <rect width={a.series.count} height="14" fill="#091219" />
            {Array.from({ length: a.series.count }, (_, i) =>
              (
                body === "Sun"
                  ? isSunlit(a.series, i, criteria)
                  : hasComm(a.series, i, criteria)
              ) ? (
                <rect
                  key={i}
                  x={i}
                  width="1.2"
                  height="14"
                  fill={body === "Sun" ? "#d7bd7e" : "#7db6ce"}
                />
              ) : null,
            )}
          </svg>
        </div>
      ))}
      <small>Click a band to move the viewing clock. Study dates change only through explicit controls.</small>
    </div>
  );
}
function Horizon({ a }: { a: SiteAnalysis }) {
  const values = Array.from(a.horizon.elevDeg),
    lo = Math.min(-3, ...values),
    hi = Math.max(3, ...values);
  return (
    <svg
      className="v1-horizon"
      viewBox="0 0 360 100"
      role="img"
      aria-label="Terrain horizon around selected observer"
    >
      <polyline
        fill="none"
        stroke="#d7bd7e"
        points={values
          .map(
            (v, i) =>
              `${(i / values.length) * 360},${90 - ((v - lo) / (hi - lo)) * 80}`,
          )
          .join(" ")}
      />
      <text x="0" y="99" fill="#879ca6" fontSize="8">
        N
      </text>
      <text x="177" y="99" fill="#879ca6" fontSize="8">
        S
      </text>
    </svg>
  );
}
function Assumptions() {
  const h = useStore((s) => s.observerM),
    c = useStore((s) => s.criteria);
  return (
    <details className="v1-detail">
      <summary>Scientific assumptions</summary>
      <div className="v1-fields">
        <label>
          Observer height m
          <input
            type="number"
            min="0"
            max="100"
            value={h}
            onChange={(e) =>
              useStore.getState().setAssumptions({
                observerM: Math.max(0, Math.min(100, +e.target.value)),
              })
            }
          />
        </label>
        <label>
          Sun disc criterion
          <select
            value={c.minSunFrac}
            onChange={(e) =>
              useStore
                .getState()
                .setAssumptions({ minSunFrac: +e.target.value })
            }
          >
            <option value="0.001">Any visible portion</option>
            <option value="0.5">At least half</option>
            <option value="0.999">Essentially all</option>
          </select>
        </label>
        <label>
          Earth mask °
          <input
            type="number"
            min="0"
            max="15"
            value={c.earthMaskDeg}
            onChange={(e) =>
              useStore.getState().setAssumptions({
                earthMaskDeg: Math.max(0, Math.min(15, +e.target.value)),
              })
            }
          />
        </label>
      </div>
      <p>
        Earth mask applies to its centre above the terrain horizon. Changing
        assumptions recalculates all browser comparisons.
      </p>
    </details>
  );
}
function Markers({
  pins,
  elevation,
}: {
  pins: Pin[];
  elevation: (a: number, b: number) => number;
}) {
  return (
    <>
      {pins.map((p) => {
        const v = new THREE.Vector3(
            ...sitePosKm(p.lat, p.lon, elevation(p.lat, p.lon) + 15),
          ),
          q = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            v.clone().normalize(),
          );
        return (
          <mesh
            key={p.id}
            position={v}
            quaternion={q}
            scale={0.15}
            onBeforeRender={function (this: THREE.Mesh, _r, _s, c) {
              this.scale.setScalar(c.position.distanceTo(v) * 0.006);
            }}
            onClick={(e) => {
              e.stopPropagation();
              useStore.getState().setActivePin(p.id);
            }}
          >
            <ringGeometry args={[0.8, 1, 48]} />
            <meshBasicMaterial
              color="#d7bd7e"
              side={THREE.DoubleSide}
              depthTest={false}
            />
          </mesh>
        );
      })}
    </>
  );
}
