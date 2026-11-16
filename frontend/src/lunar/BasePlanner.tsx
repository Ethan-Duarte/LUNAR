// Original LUNAR connected-base engineering workspace. NASA-derived terrain, explicit model limits.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {createPortal} from "react-dom";
import type { SiteAnalysis } from "../ui/useSiteAnalysis";
import type { Ephem } from "../lib/ephem";
import { sourceHeight, type HeightSource } from "../lib/terrain";
import { localFrame, R_KM, upVector } from "../lib/geo";
import { useStore } from "../store";
import {BaseComparison,failureIntervals} from "./BaseComparison";
import {BASE_LESSON,lessonCanAdvance} from "./baseLesson";
import {Help} from "./Help";
import {ProjectFileInput} from "./ProjectFileInput";
import { exportFile } from "./science";
import { distanceKm, type Facility, type Role } from "./network";
import {
  DEFAULT_ENGINEERING,
  validateSettings,
  type EngineeringSettings,
  type FacilityProfile,
  type Link,
  type RankedDesign,
  type evaluateDesign,
} from "./engineering";
import type { PlannerRequest } from "./planner.worker";
interface Report {
  schema: string;
  model: string;
  start: number;
  settings: EngineeringSettings;
  criteria: { earthMaskDeg: number };
  facilities: Facility[];
  profiles: FacilityProfile[];
  links: Link[];
  result: ReturnType<typeof evaluateDesign>;
  arrayScale: number | null;
  azimuthStepDeg: number;
  horizonRadiusKm: number;
}
const KEY = "lunar.base.v1.1";
const roles: Role[] = ["habitat", "power", "resource", "relay", "landing"];
function validateFacilities(value: unknown): Facility[] {
  if (
    !Array.isArray(value) ||
    value.length > 8 ||
    value.some(
      (f) =>
        !f ||
        !roles.includes(f.role) ||
        !Number.isFinite(
          f.lat + f.lon + f.mast + (f.areaM2 ?? 0) + (f.loadKW ?? 0),
        ) ||
        Math.abs(f.lat) > 90 ||
        f.mast < 0 ||
        f.mast > 100 ||
        (f.areaM2 ?? 0) < 0 ||
        (f.loadKW ?? 0) < 0,
    )
  )
    throw Error("Invalid facilities");
  return value.map((f) => ({
    ...f,
    id: String(f.id || crypto.randomUUID()),
    name: String(f.name ?? f.role).slice(0, 80),
    lon: ((((f.lon + 180) % 360) + 360) % 360) - 180,
    fixed: !!f.fixed,
  }));
}
function initial(): { facilities: Facility[]; settings: EngineeringSettings } {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) || "null");
    if (j) {
      const facilities = validateFacilities(j.facilities),
        settings = { ...DEFAULT_ENGINEERING, ...j.settings };
      validateSettings(settings);
      return { facilities, settings };
    }
  } catch {
    /* Invalid recovery data never mutates the live scenario. */
  }
  return { facilities: [] as Facility[], settings: { ...DEFAULT_ENGINEERING } };
}
function destination(
  anchor: { lat: number; lon: number },
  north: number,
  east: number,
) {
  const f = localFrame(anchor.lat, anchor.lon),
    r = Math.hypot(north, east),
    a = r / R_KM,
    v = f.u.map(
      (x, i) =>
        x * Math.cos(a) +
        (r ? (north * f.n[i] + east * f.e[i]) / r : 0) * Math.sin(a),
    );
  return {
    lat: (Math.asin(Math.max(-1, Math.min(1, v[2]))) * 180) / Math.PI,
    lon: (Math.atan2(v[1], v[0]) * 180) / Math.PI,
  };
}
export function BasePlanner({
  active,
  ready,
  sourceOf,
  ephem,
  windowStart,
  advanced,
  onLocate,
  onLayout,
  onLinks,
  onPlaceReady,
  guideHost,
  onRevealGuide,
}: {
  guideHost?: HTMLElement|null;
  onRevealGuide?:()=>void;
  active?: SiteAnalysis;
  ready: boolean;
  sourceOf: (lat: number, lon: number) => HeightSource;
  ephem: Ephem | null;
  windowStart: number;
  advanced: boolean;
  onLocate: (lat: number, lon: number, label?: string) => void;
  onLayout?: (f: Facility[]) => void;
  onLinks?: (links: Link[]) => void;
  onPlaceReady?: (fn: (lat: number, lon: number, id?: string) => void) => void;
}) {
  const [boot] = useState(initial),
    [facilities, rawSetFacilities] = useState(boot.facilities),
    [settings, setSettings] = useState(boot.settings),
    [role, setRole] = useState<Role>("habitat"),
    [selected, setSelected] = useState<string | null>(null),
    [placing, setPlacing] = useState(false),
    [placementMode,setPlacementMode]=useState<"inspect"|"add"|"move">("inspect"),
    [lesson,setLesson]=useState<number|null>(null),
    [guideCollapsed,setGuideCollapsed]=useState(false),
    [radius, setRadius] = useState(2),
    [maxTower, setMaxTower] = useState(50),
    [report, setReport] = useState<Report | null>(null),
    [comparison,setComparison]=useState<Report|null>(null),
    [alternatives, setAlternatives] = useState<RankedDesign[]>([]),
    [snapshots, setSnapshots] = useState<{ name: string; project: unknown }[]>(
      [],
    ),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [searchNote, setSearchNote] = useState(""),
    [duration, setDuration] = useState(0);
  const lessonBackup=useRef<unknown>(null);
  const history = useRef<{ past: Facility[][]; future: Facility[][] }>({
    past: [],
    future: [],
  });
  function setFacilities(value: Facility[] | ((f: Facility[]) => Facility[])) {
    const next = typeof value === "function" ? value(facilities) : value;
    if (JSON.stringify(next) === JSON.stringify(facilities)) return;
    history.current.past = [...history.current.past.slice(-29), facilities];
    history.current.future = [];
    rawSetFacilities(next);
  }
  const worker = useRef<Worker | null>(null),
    jobStart = useRef(0),
    criteria = useStore((s) => s.criteria),
    mast = useStore((s) => s.observerM);
  const anchor = facilities.find((f) => f.role === "habitat") ??
    active?.pin ?? { lat: -89.4399, lon: 222.8524 };
  const source = useMemo(() => {
    const points = [anchor, ...facilities],
      pool = points.flatMap((f) => sourceOf(f.lat, f.lon).terrains);
    return {
      terrains: [...new Set(pool)].sort(
        (a, b) => a.levels.at(-1)!.pixel - b.levels.at(-1)!.pixel,
      ),
      global: sourceOf(anchor.lat, anchor.lon).global,
    };
  }, [facilities, sourceOf, anchor.lat, anchor.lon]);
  useEffect(()=>{onLinks?.(report?.links.filter(e=>e.km<=settings.maxLinkKm)??[])},[report,settings.maxLinkKm,onLinks]);
  const inputKey = JSON.stringify([
    facilities,
    settings,
    windowStart,
    criteria.earthMaskDeg,
  ]);
  useEffect(() => {
    onLayout?.(facilities);
    try {
      localStorage.setItem(KEY, JSON.stringify({ facilities, settings }));
    } catch {
      /* Project export remains available when storage is blocked. */
    }
  }, [facilities, settings, onLayout]);
  useEffect(() => {
    worker.current?.terminate();
    worker.current = null;
    setBusy(false);
    setReport(null);
    setAlternatives([]);
    setSearchNote("");
  }, [inputKey, source]);
  useEffect(() => () => worker.current?.terminate(), []);
  function add(lat: number, lon: number) {
    if (facilities.length >= 8) {
      setStatus("Eight facilities is the screening limit.");
      return;
    }
    const id = crypto.randomUUID();
    setFacilities((f) => [
      ...f,
      {
        id,
        name: role + " " + (f.filter((x) => x.role === role).length + 1),
        role,
        lat,
        lon,
        mast: role === "relay" ? 10 : mast,
        areaM2: role === "power" ? 20 : 0,
        loadKW: 0,
        fixed: role === "habitat" || role === "resource",
      },
    ]);
    setSelected(id);
    setPlacing(false);
    setPlacementMode("inspect");
    setStatus("Facility added. Recalculate after editing.");
  }
  function mapPlace(lat: number, lon: number, id?: string) {
    if (id) {
      setSelected(id);
      return;
    }
    if (placementMode === "move" && selected) {
      update(selected, { lat, lon });
      setPlacing(false);
      setPlacementMode("inspect");
    } else if(placementMode === "add") add(lat, lon);
    else setStatus("Inspect mode: select a facility, or choose Add component / Move component before clicking ground.");
  }
  useEffect(() => {
    onPlaceReady?.(mapPlace);
  }, [onPlaceReady, facilities, role, mast, placing, selected,placementMode]);
  function update(id: string, changes: Partial<Facility>) {
    setFacilities((f) =>
      f.map((x) => (x.id === id ? { ...x, ...changes } : x)),
    );
  }
  function setting<K extends keyof EngineeringSettings>(
    key: K,
    value: EngineeringSettings[K],
  ) {
    setSettings((s) => ({ ...s, [key]: value }));
  }
  const startLabel = new Date(windowStart).toISOString().slice(0, 16);
  function project() {
    return {
      schema: "lunar-base-2",
      version: "1.3-preview",
      facilities,
      settings,
      start: windowStart,
      criteria,
      radiusKm: radius,
      maxTowerM: maxTower,
      report,
      comparisonBaseline:comparison,
      limits: LIMITS,
    };
  }
  function restore(value: unknown) {
    const j = value as ReturnType<typeof project>;
    if (!["lunar-base-1", "lunar-base-2"].includes(j?.schema))
      throw Error("Unknown base project schema");
    const f = validateFacilities(j.facilities);
    const s = { ...DEFAULT_ENGINEERING, ...j.settings };
    validateSettings(s);
    if (
      j.schema === "lunar-base-2" &&
      (!Number.isFinite(j.start) ||
        !j.criteria ||
        !Number.isFinite(j.criteria.earthMaskDeg + j.criteria.minSunFrac) ||
        j.criteria.earthMaskDeg < 0 ||
        j.criteria.earthMaskDeg > 15 ||
        j.criteria.minSunFrac < 0 ||
        j.criteria.minSunFrac > 1)
    )
      throw Error("Invalid project time or criteria");
    setFacilities(f);
    setSettings(s);
    if (j.schema === "lunar-base-2") {
      useStore.getState().setAssumptions(j.criteria);
      useStore.getState().setPlaying(false);
      useStore.getState().setTime(j.start);
      useStore.getState().setWindowStart(j.start);
      setRadius(
        Number.isFinite(j.radiusKm) && j.radiusKm > 0 && j.radiusKm <= 10
          ? j.radiusKm
          : 2,
      );
      setMaxTower(
        Number.isFinite(j.maxTowerM) && j.maxTowerM >= 2 && j.maxTowerM <= 100
          ? j.maxTowerM
          : 50,
      );
    }
    setSelected(null);
    setComparison(null);
    setReport(null);
    setStatus(
      "Project restored; recalculate with current data. Previous report remains in the exported file.",
    );
  }
  async function open(file: File) {
    try {
      restore(JSON.parse(await file.text()));
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  }
  function run(kind: PlannerRequest["kind"]) {
    if (!ephem || !ready) return;
    try {
      validateSettings(settings);
      validateFacilities(facilities);
      worker.current?.terminate();
      const w = new Worker(new URL("./planner.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.current = w;
      setBusy(true);
      setStatus("Starting terrain analysis…");
      setReport(null);
      setAlternatives([]);
      setSearchNote("");
      jobStart.current = performance.now();
      w.onmessage = (e) => {
        const j = e.data;
        if (j.progress) setStatus(j.progress);
        if (j.error) {
          setStatus(j.error);
          setBusy(false);
          w.terminate();
          worker.current = null;
        }
        if (j.done) {
          setReport(j.report ?? null);
          setAlternatives(j.alternatives ?? []);
          setSearchNote(j.note ? `${j.tested} designs tested. ${j.note}` : "");
          setDuration((performance.now() - jobStart.current) / 1000);
          setStatus(
            j.report
              ? "Analysis complete. Review assumptions and failures below."
              : "Search complete. Inspect alternatives before applying.",
          );
          setBusy(false);
          w.terminate();
          worker.current = null;
        }
      };
      w.onerror = (e) => {
        setStatus("Analysis worker failed: " + e.message);
        setBusy(false);
        w.terminate();
        worker.current = null;
      };
      w.postMessage({
        kind,
        facilities,
        source,
        ephem,
        start: windowStart,
        settings,
        radiusKm: radius,
        earthMaskDeg: criteria.earthMaskDeg,
        maxTowerM: maxTower,
      } satisfies PlannerRequest);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  }
  const extent = Math.max(
      radius * 1.25,
      ...facilities.map((f) => distanceKm(anchor, f) * 1.15),
      0.1,
    ),
    frame = localFrame(anchor.lat, anchor.lon);
  const xy = (f: { lat: number; lon: number }) => {
    const u = upVector(f.lat, f.lon);
    return [
      160 +
        ((u.reduce((a, v, i) => a + v * frame.e[i], 0) * R_KM) / extent) * 140,
      160 -
        ((u.reduce((a, v, i) => a + v * frame.n[i], 0) * R_KM) / extent) * 140,
    ];
  };
  const ground = useMemo(() => {
    const cells: { x: number; y: number; h: number }[] = [];
    for (let j = 0; j < 24; j++)
      for (let i = 0; i < 24; i++) {
        const p = destination(
          anchor,
          ((160 - ((j + 0.5) * 320) / 24) / 140) * extent,
          ((((i + 0.5) * 320) / 24 - 160) / 140) * extent,
        );
        cells.push({
          x: (i * 320) / 24,
          y: (j * 320) / 24,
          h: sourceHeight(source, ...upVector(p.lat, p.lon)),
        });
      }
    return cells;
  }, [source, anchor.lat, anchor.lon, extent]);
  const valid = ground.filter((p) => Number.isFinite(p.h)),
    lo = Math.min(...valid.map((p) => p.h)),
    hi = Math.max(...valid.map((p) => p.h)),
    picked = facilities.find((f) => f.id === selected),
    r = report?.result;
  const lessonStep=lesson===null?null:BASE_LESSON[lesson];
  useEffect(()=>{if(lesson===1)setRole("habitat");if(lesson===2)setRole("power")},[lesson]);
  function startLesson(){lessonBackup.current=JSON.parse(JSON.stringify(project()));setFacilities([]);setSelected(null);setSettings({...DEFAULT_ENGINEERING,days:2,loadKW:1,requireEarth:false,maxSlopeDeg:90});setPlacementMode("inspect");setLesson(0)}
  function endLesson(restorePrevious:boolean){if(restorePrevious&&lessonBackup.current)restore(lessonBackup.current);setLesson(null);setPlacementMode("inspect")}
  const numeric = (
    label: string,
    key: keyof EngineeringSettings,
    min: number,
    max: number,
    step: number,
  ) => (
    <div className="base-field"><label>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={settings[key] as number}
        onChange={(e) => setting(key, +e.target.value as never)}
      />
    </label>{SETTING_HELP[key]&&<Help title={label}><p>{SETTING_HELP[key]}</p></Help>}</div>
  );
  const guide:ReactNode=(lessonStep&&lesson!==null?<section className="base-lesson viewer-lesson" aria-label="Guided Base lesson"><p className="v1-eyebrow">STEP {lesson+1} / {BASE_LESSON.length}</p><h2>{lessonStep.title}</h2><div className="v1-actions"><button onClick={()=>setGuideCollapsed(!guideCollapsed)}>{guideCollapsed?"Expand":"Collapse"}</button><button onClick={()=>{onRevealGuide?.();requestAnimationFrame(()=>document.querySelector(`[data-guide="${lessonStep.target==='lesson'?'components':lessonStep.target}"]`)?.scrollIntoView?.({block:"center",behavior:"smooth"}))}}>Show this control</button></div>{!guideCollapsed&&<p>{lessonStep.body}</p>}{lesson===4&&<button onClick={()=>{setFacilities(f=>f.map(x=>x.role==='power'?{...x,areaM2:0}:x));setSettings(v=>({...v,batteryKWh:0,loadKW:1,days:2}))}}>Try insufficient power</button>}{lesson===5&&<button onClick={()=>{setFacilities(f=>f.map(x=>x.role==='power'?{...x,areaM2:20}:x));setSettings(v=>({...v,batteryKWh:100,loadKW:1,days:2}))}}>Restore lesson power</button>}<div className="v1-actions"><button disabled={lesson===0} onClick={()=>setLesson(lesson-1)}>Back</button>{lesson<BASE_LESSON.length-1?<button disabled={!lessonCanAdvance(lesson,facilities,r??null)} onClick={()=>setLesson(lesson+1)}>Next step</button>:<button onClick={()=>endLesson(false)}>Keep this design</button>}<button aria-label="Return to my design" onClick={()=>endLesson(true)}>Exit / restore my design</button></div><p className="v1-note">Next unlocks when the step’s task is complete. The lesson relaxes slope/Earth requirements to isolate electricity; restore realistic constraints afterward.</p></section>:<button className="v1-primary" onClick={startLesson}>Start guided Base lesson</button>);
  return (
    <div className="base-workspace" data-lesson-target={lessonStep?.target??"none"}>
      <p className="v1-eyebrow">LUNAR / CONNECTED BASE ENGINEERING</p>
      <h1>Design a place to operate.</h1>
      <p>
        Choose components, place them on the map or terrain, then test power,
        eclipses and geometric radio paths. All results are preliminary
        screening.
      </p>
      {!advanced && (
        <p className="v1-note">
          Advanced mode exposes the complete engineering workspace.
        </p>
      )}
      {guideHost&&lessonStep?createPortal(guide,guideHost):guide}

      <section data-guide="components"><div className="v1-segment" aria-label="Base map interaction">{([['inspect','Inspect'],['add','Add component'],['move','Move component']] as const).map(([mode,label])=><button key={mode} aria-pressed={placementMode===mode} disabled={mode==='move'&&!selected} onClick={()=>{setPlacementMode(mode);setPlacing(mode==='move')}}>{label}</button>)}</div><p role="status" className="base-mode">{placementMode==='inspect'?'Inspect: clicking empty ground never adds a component.':placementMode==='add'?`Add: click ground once to place a ${role}.`:'Move: click a new position for the selected component.'}</p>
      <div className="v1-fields">
        <label>
          New component
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            {roles.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <button
          disabled={!ready || !active}
          onClick={() => active && add(active.pin.lat, active.pin.lon)}
        >
          Use selected observer
        </button>
      </div>
      <button
        disabled={!ready}
        onClick={() => {
          setFacilities([
            {
              id: crypto.randomUUID(),
              name: "Ridge habitat",
              role: "habitat",
              lat: -89.4399,
              lon: 222.8524,
              mast: 2,
              fixed: true,
            },
            {
              id: crypto.randomUUID(),
              name: "Ridge solar",
              role: "power",
              lat: -89.4399,
              lon: 222.8524,
              mast: 2,
              areaM2: 20,
              fixed: false,
            },
          ]);
          setSettings({
            ...DEFAULT_ENGINEERING,
            days: 2,
            requireEarth: false,
            maxSlopeDeg: 90,
          });
          useStore.getState().setTime(Date.parse("2026-11-14T00:00:00Z"));
          useStore
            .getState()
            .setWindowStart(Date.parse("2026-11-14T00:00:00Z"));
          setStatus(
            "Electrical tutorial loaded: co-located components intentionally isolate the power calculation. Move the array, add a relay and tighten constraints for a spatial design.",
          );
          onLocate(-89.4399, 222.8524, "Connecting Ridge tutorial");
        }}
      >
        Load example design
      </button>
      <Help title="Placing components"><p>Use Inspect to select existing facilities. Add component places one facility and returns to Inspect. Move component relocates the selected facility once. Fixed means a location stays fixed during a search; it does not prevent manual edits.</p></Help></section>
      <svg
        className="base-map"
        viewBox="0 0 320 320"
        role="img"
        aria-label="Measured elevation base map; click to place a facility"
        onClick={(e) => {
          if(placementMode === "inspect"){setStatus("Inspect mode: use Add component to place a facility.");return}
          const box = e.currentTarget.getBoundingClientRect();
          if(box.width<=0||box.height<=0)return;
          const east =
              ((((e.clientX - box.left) / box.width) * 320 - 160) / 140) *
              extent,
            north =
              ((160 - ((e.clientY - box.top) / box.height) * 320) / 140) *
              extent;
          const p = destination(anchor, north, east);
          mapPlace(p.lat, p.lon);
        }}
      >
        {ground.map((p, i) => (
          <rect
            key={i}
            x={p.x}
            y={p.y}
            width={14}
            height={14}
            fill={
              Number.isFinite(p.h)
                ? `hsl(205 12% ${16 + (35 * (p.h - lo)) / Math.max(1, hi - lo)}%)`
                : "#171d24"
            }
          />
        ))}
        <circle
          cx="160"
          cy="160"
          r={(radius / extent) * 140}
          fill="none"
          stroke="#d7bd7e"
          strokeDasharray="4 4"
        />
        {report?.links
          .filter((e) => e.km <= settings.maxLinkKm)
          .map((e) => {
            const a = xy(facilities.find((f) => f.id === e.a)!),
              b = xy(facilities.find((f) => f.id === e.b)!);
            return (
              <line
                key={e.a + e.b}
                x1={a[0]}
                y1={a[1]}
                x2={b[0]}
                y2={b[1]}
                stroke={e.status === "clear" ? "#7ec9aa" : "#e69180"}
                strokeWidth="1.5"
                strokeDasharray={e.status === "clear" ? "" : "4 3"}
              />
            );
          })}
        {facilities.map((f) => {
          const p = xy(f);
          return (
            <g
              key={f.id}
              role="button"
              tabIndex={0}
              aria-label={"Select " + f.name}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(f.id);
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelected(f.id);
              }}
            >
              <circle
                cx={p[0]}
                cy={p[1]}
                r={selected === f.id ? 8 : 6}
                fill={
                  f.role === "power"
                    ? "#e7c65e"
                    : f.role === "relay"
                      ? "#78b9dc"
                      : "#e5ecee"
                }
                stroke={r?.disconnectedIds?.includes(f.id)?"#f18278":"#111"}
                strokeWidth={r?.disconnectedIds?.includes(f.id)?3:1}
              />
              <text x={p[0] + 9} y={p[1] - 8} fill="white" fontSize="10">
                {f.name}
              </text>
            </g>
          );
        })}
        <text x="8" y="16" fill="white" fontSize="10">
          N ↑ · elevation shading · radius {radius} km
        </text>
        <text x="8" y="309" fill="white" fontSize="9">
          Decorative interpolation adds no measured terrain detail
        </text>
      </svg>
      <div className="v1-actions">
        <button
          disabled={!history.current.past.length}
          onClick={() => {
            const previous = history.current.past.pop()!;
            history.current.future.push(facilities);
            rawSetFacilities(previous);
            setSelected(null);
          }}
        >
          Undo facility edit
        </button>
        <button
          disabled={!history.current.future.length}
          onClick={() => {
            const next = history.current.future.pop()!;
            history.current.past.push(facilities);
            rawSetFacilities(next);
            setSelected(null);
          }}
        >
          Redo
        </button>
      </div>
      <div className="base-facility-list">
        {facilities.map((f) => (
          <button
            key={f.id}
            aria-pressed={selected === f.id}
            onClick={() => setSelected(f.id)}
          >
            {f.name} · {f.mast} m {f.fixed ? "· fixed" : ""}
          </button>
        ))}
      </div>
      {picked && (
        <section className="v1-facility">
          <label>
            Name
            <input
              value={picked.name}
              onChange={(e) => update(picked.id, { name: e.target.value })}
            />
          </label>
          <div className="v1-fields">
            <label>
              Latitude
              <input
                type="number"
                min="-90"
                max="90"
                step="0.0001"
                value={picked.lat}
                onChange={(e) => update(picked.id, { lat: +e.target.value })}
              />
            </label>
            <label>
              Longitude east
              <input
                type="number"
                step="0.0001"
                value={picked.lon}
                onChange={(e) => update(picked.id, { lon: +e.target.value })}
              />
            </label>
            <label>
              Panel / antenna height (m)
              <input
                type="number"
                min="0"
                max="100"
                value={picked.mast}
                onChange={(e) => update(picked.id, { mast: +e.target.value })}
              />
            </label>
            {picked.role === "power" && (
              <label>
                Array area (m²)
                <input
                  type="number"
                  min="0"
                  value={picked.areaM2 ?? 0}
                  onChange={(e) =>
                    update(picked.id, { areaM2: +e.target.value })
                  }
                />
              </label>
            )}
            <label>
              Additional load (kW)
              <input
                type="number"
                min="0"
                step=".1"
                value={picked.loadKW ?? 0}
                onChange={(e) => update(picked.id, { loadKW: +e.target.value })}
              />
            </label>
          </div>
          <label>
            <input
              type="checkbox"
              checked={!!picked.fixed}
              onChange={(e) => update(picked.id, { fixed: e.target.checked })}
            />{" "}
            Fixed location during search
          </label>
          <div className="v1-actions">
            <button aria-pressed={placing} onClick={() => {setPlacing(!placing);setPlacementMode(placing?"inspect":"move")}}>
              {placing ? "Click new position…" : "Move on map / terrain"}
            </button>
            <button
              onClick={() => onLocate(picked.lat, picked.lon, picked.name)}
            >
              Inspect terrain ↗
            </button>
            <button
              onClick={() => {
                setFacilities((f) => f.filter((x) => x.id !== picked.id));
                setSelected(null);
              }}
            >
              Remove
            </button>
          </div>
        </section>
      )}
      <h2>Mission and electrical assumptions</h2><Help title="Power, energy and this mission"><p>kW is a rate; kWh is energy over time. A constant 1 kW demand consumes 24 kWh per day. Demand is for the whole base, plus any additional per-component loads. Adding a habitat with 0 additional load does not automatically add another 1 kW.</p></Help>
      <label>
        Start (UTC)
        <input
          type="datetime-local"
          value={startLabel}
          onChange={(e) => {
            const t = Date.parse(e.target.value + "Z");
            if (Number.isFinite(t)) {
              useStore.getState().setPlaying(false);
              useStore.getState().setTime(t);
              useStore.getState().setWindowStart(t);
            }
          }}
        />
      </label>
      <div className="v1-fields">
        {numeric("Duration (days)", "days", 1, 60, 1)}
        {numeric("Base demand (kW)", "loadKW", 0, 1e6, 0.1)}
        {numeric("Usable battery (kWh)", "batteryKWh", 0, 1e7, 10)}
        {numeric("Required reserve fraction", "reserveSoc", 0, 1, 0.05)}
        {numeric("Array efficiency", "efficiency", 0.01, 1, 0.01)}
        {numeric("System derating", "derate", 0.01, 1, 0.01)}
      </div>
      <label>
        Panel model
        <select
          value={settings.panelMode}
          onChange={(e) =>
            setting("panelMode", e.target.value as "tracking" | "horizontal")
          }
        >
          <option value="tracking">Ideal two-axis Sun tracking</option>
          <option value="horizontal">Horizontal panel, cosine incidence</option>
        </select>
      </label>
      <details className="v1-detail">
        <summary>Electrical and sampling details</summary>
        <div className="v1-fields">
          {numeric("Initial state of charge", "initialSoc", 0, 1, 0.05)}
          {numeric("Charge efficiency", "chargeEfficiency", 0.01, 1, 0.01)}
          {numeric(
            "Discharge efficiency",
            "dischargeEfficiency",
            0.01,
            1,
            0.01,
          )}
          {numeric("Solar flux at 1 AU (W/m²)", "solarFlux", 1, 2000, 1)}
          {numeric(
            "Fractional cable loss / km",
            "cableLossPerKm",
            0,
            0.1,
            0.001,
          )}
        </div>
        <label>
          Time step
          <select
            value={settings.stepMinutes}
            onChange={(e) => setting("stepMinutes", +e.target.value)}
          >
            {[5, 10, 20, 60].map((n) => (
              <option key={n} value={n}>
                {n} minutes
              </option>
            ))}
          </select>
        </label>
        <p>
          Constant demand plus component loads. Usable battery excludes
          inaccessible capacity. Initial charge is an input, not free recurring
          energy. Panel efficiency is constant; thermal effects, degradation and
          voltage-dependent cable physics are not modeled.
        </p>
      </details>
      <details className="v1-detail">
        <summary>Optional free-space radio budget</summary>
        <label>
          <input
            type="checkbox"
            checked={settings.rfEnabled}
            onChange={(e) => setting("rfEnabled", e.target.checked)}
          />{" "}
          Require nonnegative link-budget margin
        </label>
        <div className="v1-fields">
          {numeric("Frequency (GHz)", "frequencyGHz", 0.1, 100, 0.1)}
          {numeric("Transmitter power (W)", "txPowerW", 0.1, 1e5, 1)}
          {numeric("Transmit gain (dBi)", "txGainDbi", -20, 100, 1)}
          {numeric("Surface receive gain (dBi)", "rxGainDbi", -20, 100, 1)}
          {numeric("Earth receive gain (dBi)", "earthRxGainDbi", -20, 100, 1)}
          {numeric("System noise (K)", "noiseK", 1, 1e5, 10)}
          {numeric("Data rate (kb/s)", "rateKbps", 0.001, 1e7, 10)}
          {numeric("Required Eb/N₀ (dB)", "requiredEbN0Db", -20, 100, 1)}
          {numeric(
            "Combined fixed losses (dB)",
            "implementationLossDb",
            0,
            100,
            1,
          )}
        </div>
        <p>
          Example assumptions, not actual DSN antenna performance. Friis
          free-space loss and thermal-noise Eb/N₀. No Fresnel clearance, fading,
          weather, station visibility/scheduling or pointing model.
        </p>
      </details>
      <h2>Constraints and bounded search</h2><Help title="What a search can change"><p>Fix a habitat or resource anchor. Leave one to three other facilities movable. Search tests nine positions around the first habitat, checks connections and resizes shortlisted arrays against current storage. It samples candidates; it does not prove a continuous global optimum.</p></Help>
      <div className="v1-fields">
        {numeric(
          "Maximum corridor / radio link (km)",
          "maxLinkKm",
          0.01,
          100,
          0.1,
        )}
        {numeric("Pad–habitat exclusion (km)", "exclusionKm", 0, 100, 0.1)}
        {numeric("Maximum terrain slope (°)", "maxSlopeDeg", 0, 90, 1)}
        {numeric("Placement sensitivity radius (m)", "footprintM", 0, 500, 10)}
        {numeric("Maximum Earth outage (h)", "maxOutageHours", 0, 1440, 1)}
        <label>
          Search radius (km)
          <input
            type="number"
            min=".1"
            max="10"
            step=".1"
            value={radius}
            onChange={(e) => setRadius(+e.target.value)}
          />
        </label>
        <label>
          Height-sweep maximum (m)
          <input
            type="number"
            min="2"
            max="100"
            value={maxTower}
            onChange={(e) => setMaxTower(+e.target.value)}
          />
        </label>
      </div>
      <label>
        <input
          type="checkbox"
          checked={settings.requireEarth}
          onChange={(e) => setting("requireEarth", e.target.checked)}
        />{" "}
        Require habitat contact through habitat/relay nodes
      </label>
      <p className="v1-note">
        Search is centred on the first habitat. One to three components may
        move. Resource, habitat and other fixed anchors stay put. This is
        geometric Earth access, not DSN scheduling or an RF link budget.
      </p>
      <div className="v1-actions" data-guide="evaluate">
        <button
          className="v1-primary"
          disabled={busy || !ready || !facilities.length}
          onClick={() => run("evaluate")}
        >
          Evaluate design
        </button>
        <button
          disabled={busy || !ready || !facilities.length}
          onClick={() => run("search")}
        >
          Search nearby layouts
        </button>
        <button
          disabled={busy || !ready || !facilities.length}
          onClick={() => run("height")}
        >
          Test tower heights
        </button>
        <button
          disabled={busy || !ready || !facilities.length}
          onClick={() => run("robustness")}
        >
          Test placement sensitivity
        </button>
        {busy && (
          <button
            onClick={() => {
              worker.current?.terminate();
              worker.current = null;
              setBusy(false);
              setStatus("Calculation cancelled.");
            }}
          >
            Cancel
          </button>
        )}
      </div>
      <p role="status" aria-live="polite">
        {status}
      </p>
      {duration > 0 && !busy && (
        <small>Last calculation: {duration.toFixed(1)} s on this device.</small>
      )}
      {comparison&&<BaseComparison baseline={comparison} current={report} onClear={()=>setComparison(null)}/>}
      {r && report && (
        <>
          <h2>
            {r.feasible
              ? "Meets the selected screening constraints"
              : "Design needs changes"}
          </h2>
          <button onClick={()=>setComparison(structuredClone(report))}>Keep current result as comparison baseline</button>
          <Help title="Reading the verdict"><p>All selected constraints must pass. A precharged battery can supply demand even when arrays are disconnected; that does not make the layout connected or sustainable. Electrical demand, connectivity, terrain and Earth access are separate checks.</p></Help>
          {!r.electricalConnected&&<p className="v1-alert">Generation below means power delivered to the shared bus. A disconnected layout is conservatively assigned zero delivered solar power; the arrays may still receive sunlight. Inspect the highlighted components and connection table.</p>}
          {r.failures.map((f, i) => (
            <p className="v1-alert" key={i}>
              {f}
            </p>
          ))}
          <div className="v1-metrics">
            <div>
              <small>Unmet demand</small>
              <strong>{r.power.unmetKWh.toFixed(2)} kWh</strong>
            </div>
            <div>
              <small>Minimum SOC</small>
              <strong>{(r.power.minSoc * 100).toFixed(1)}%</strong>
            </div>
            <div>
              <small>Earth access</small>
              <strong>{(r.contactShare * 100).toFixed(1)}%</strong>
            </div>
            <div>
              <small>Generation</small>
              <strong>{r.power.generatedKWh.toFixed(1)} kWh</strong>
            </div>
          </div>
          {r.totalArrayM2===0&&<p className="v1-alert">This design has zero solar collection area. Any supplied demand relies on its initial stored energy; it cannot replenish that energy. A finite-mission pass is not sustainable solar operation.</p>}
          <PowerChart report={report} />
          <details className="v1-detail"><summary>Inspect blackout intervals</summary><p>Sampled intervals, not exact transition times. Jump moves the viewing clock; the study period is unchanged.</p>{[['Unmet power',failureIntervals(r.power.unmetKW,v=>Number(v)>1e-6)],['Earth contact loss',failureIntervals(r.contact,v=>!v)]] .map(([name,events])=><div key={name as string}><h3>{name as string}</h3>{!(events as {start:number;end:number}[]).length&&<p>No sampled interval.</p>}{(events as {start:number;end:number}[]).slice(0,30).map((e,i)=><p key={i}><button onClick={()=>{const time=report.start+e.start*report.settings.stepMinutes*60000,bounds=useStore.getState().timeRange;if(bounds&&(time<bounds[0]||time>bounds[1])){setStatus("This interval is outside the viewer clock range. Inspect its exported samples instead.");return}useStore.getState().setPlaying(false);useStore.getState().setTime(time);const h=report.facilities.find(f=>f.role==='habitat');if(h)onLocate(h.lat,h.lon,h.name)}}>Jump to {new Date(report.start+e.start*report.settings.stepMinutes*60000).toISOString().slice(0,16)} UTC</button> · {((e.end-e.start)*report.settings.stepMinutes/60).toFixed(2)} h</p>)}{(events as unknown[]).length>30&&<p>First 30 intervals shown; full samples are in the exported report.</p>}</div>)}</details>
          <p>
            Battery ends at {r.power.finalKWh.toFixed(1)} kWh; longest
            unmet-power spell {r.power.longestShortfallHours.toFixed(2)} h.
            Longest Earth-contact outage {r.longestContactLossHours.toFixed(2)}{" "}
            h.
          </p>
          <p>
            Minimum tested-model battery capacity for this finite mission and
            selected reserve:{" "}
            <b>
              {r.requiredBatteryKWh === null
                ? "No finite recommendation"
                : r.requiredBatteryKWh.toFixed(1) + " kWh"}
            </b>
            . Assumes the selected initial SOC; not a sustainable
            repeating-cycle design.
          </p>
          {r.electricalConnected && report.arrayScale !== null && (
            <>
              <p>
                At the current battery size, the electrical model needs{" "}
                {Math.max(0, report.arrayScale * r.totalArrayM2).toFixed(1)} m²
                total array area in the existing proportions. Communication and
                slope constraints are assessed separately.
              </p>
              <button
                onClick={() => {
                  const scale = report.arrayScale!;
                  setFacilities((f) =>
                    f.map((x) =>
                      x.role === "power"
                        ? {
                            ...x,
                            areaM2:
                              Math.ceil((x.areaM2 ?? 0) * scale * 10) / 10,
                          }
                        : x,
                    ),
                  );
                }}
              >
                Apply proposed array sizes
              </button>
            </>
          )}
          <h2>Eclipses and terrain obstructions</h2>
          <p>
            {r.eclipseEvents.length} sampled eclipse interval(s);{" "}
            {r.eclipseLostGenerationKWh.toFixed(2)} kWh solar generation lost to
            eclipse. Additional unmet demand:{" "}
            {Math.max(0, r.eclipseExtraUnmetKWh).toFixed(2)} kWh.
          </p>
          <p>
            Battery requirement without eclipses:{" "}
            {r.withoutEclipseMinimumBatteryKWh?.toFixed(1) ?? "unavailable"}{" "}
            kWh; with eclipses:{" "}
            {r.requiredBatteryKWh?.toFixed(1) ?? "unavailable"} kWh.
          </p>
          {r.eclipseEvents.map((e, i) => (
            <p className="v1-note" key={i}>
              {new Date(
                report.start + e.startIndex * settings.stepMinutes * 60000,
              ).toISOString()}{" "}
              →{" "}
              {new Date(
                report.start + e.endIndex * settings.stepMinutes * 60000,
              ).toISOString()}{" "}
              · minimum unocculted Sun {(e.minVisible * 100).toFixed(1)}%
            </p>
          ))}
          {report.profiles.map((p) => (
            <p className="v1-note" key={p.id}>
              <b>{facilities.find((f) => f.id === p.id)?.name}</b>: {p.terrain};
              slope {p.slope?.toFixed(1) ?? "unknown"}°.{" "}
              {p.blocker && p.blocker.lossHours > 0
                ? `Largest geometric-daylight loss bin: azimuth ${p.blocker.az.toFixed(1)}°, ridge ${p.blocker.distanceKm.toFixed(2)} km away at ${p.blocker.alt.toFixed(2)}°; ${p.blocker.lossHours.toFixed(2)} equivalent obscured-disc hours in that azimuth bin.`
                : "No above-horizontal sunlight obstruction recorded."}
            </p>
          ))}
          <h2>Geometric connections</h2>
          <table className="v1-table">
            <thead>
              <tr>
                <th>Link</th>
                <th>km</th>
                <th>Clearance</th>
              </tr>
            </thead>
            <tbody>
              {report.links.map((e) => (
                <tr key={e.a + e.b}>
                  <td>
                    {facilities.find((f) => f.id === e.a)?.name} →{" "}
                    {facilities.find((f) => f.id === e.b)?.name}
                  </td>
                  <td>{e.km.toFixed(2)}</td>
                  <td>
                    {e.km > settings.maxLinkKm ? "over limit" : e.status}{" "}
                    {e.minClearanceM?.toFixed(1)} m
                    {settings.rfEnabled && (
                      <small> RF {e.rfMarginDb?.toFixed(1)} dB margin</small>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="v1-note">
            Power facilities share an ideal bus only when all
            habitat/power/relay nodes connect through clear straight corridors.
            Such corridors are conservative siting constraints, not routed
            cable. Radio routing uses habitat/relay nodes only; clear LOS does
            not prove an RF link.
          </p>
        </>
      )}
      {alternatives.length > 0 && (
        <>
          <h2>Search alternatives</h2>
          <p className="v1-note">{searchNote}</p><p>Ranking prioritizes passing constraints, then lower unmet demand, higher Earth access, smaller arrays, lower recommended storage, lower towers and shorter connections. Applying an alternative changes facilities only; evaluate it and compare against a retained baseline.</p>
          {alternatives.map((a, i) => (
            <article className="v1-facility" key={i}>
              <h3>
                Alternative {i + 1} ·{" "}
                {a.feasible ? "passes screening" : "constraints unmet"}
              </h3>
              <p>
                {a.arrayM2.toFixed(1)} m² array ·{" "}
                {a.batteryKWh?.toFixed(1) ?? "—"} kWh recommended storage ·{" "}
                {a.towerM} m highest relay · Earth{" "}
                {(a.contactShare * 100).toFixed(1)}%
              </p>
              <p>{a.failures.join("; ")}</p>
              <button
                onClick={() => {
                  setFacilities(a.facilities);
                  setStatus(
                    "Alternative applied. Evaluate for the full report.",
                  );
                }}
              >
                Apply facilities
              </button>
              <button
                onClick={() =>
                  exportFile(
                    "LUNAR-alternative-" + (i + 1) + ".json",
                    JSON.stringify(
                      {
                        ...project(),
                        facilities: a.facilities,
                        report: null,
                        searchResult: a,
                        searchNote,
                      },
                      null,
                      2,
                    ),
                  )
                }
              >
                Export alternative
              </button>
            </article>
          ))}
        </>
      )}
      <div className="v1-actions" data-guide="save">
        <button
          onClick={() =>
            exportFile(
              "LUNAR-base-v1.1.json",
              JSON.stringify(project(), null, 2),
            )
          }
        >
          Save complete base project ↓
        </button>
        <button
          onClick={() =>
            setSnapshots((a) => [
              ...a,
              {
                name: "Layout " + (a.length + 1),
                project: JSON.parse(JSON.stringify(project())),
              },
            ])
          }
        >
          Keep alternative
        </button>
      </div>
      <Help title="Saving and opening"><p>Save complete base project preserves facilities, dates and assumptions. Opening a project replaces those inputs and asks you to recalculate. Cancelling the file chooser leaves the current design unchanged. Keep alternative is a session snapshot; export it before closing.</p></Help>
      <ProjectFileInput label="Open base project" onOpen={open}/>
      {snapshots.map((s, i) => (
        <div className="v1-facility" key={i}>
          <b>{s.name}</b>
          <button
            onClick={() => {
              try {
                restore(s.project);
              } catch (e) {
                setStatus(String(e));
              }
            }}
          >
            Restore complete scenario
          </button>
          <button
            onClick={() =>
              exportFile(
                "LUNAR-" + s.name + ".json",
                JSON.stringify(s.project, null, 2),
              )
            }
          >
            Export
          </button>
        </div>
      ))}
      <details className="v1-detail">
        <summary>Model boundaries and evidence</summary>
        {LIMITS.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </details>
    </div>
  );
}
const LIMITS = [
  "Research prototype. Independent Earth-map holdout is unresolved; Earth-dependent recommendations are provisional.",
  "Analytic circular Earth/Sun overlap; terrain-visible and unocculted fractions are multiplied. Atmospheric refraction and exact combined masks are omitted.",
  "Time bins approximate eclipse contacts and energy integration. Use 5-minute sampling near an event; no sub-step timing claim.",
  "Terrain resolution varies. Interpolation and minimum sampled clearance do not resolve boulders or establish terrain uncertainty.",
  "Optional free-space RF budget omits Fresnel clearance, weather, fading and pointing. No DSN scheduling, plume safety, thermal survival, vehicle dynamics or certified landing safety.",
  "Search ranks sampled alternatives by feasibility, unmet energy, Earth access, array area, storage, tower height and clear-link length. It is not exhaustive over continuous terrain.",
];
function PowerChart({ report }: { report: Report }) {
  const r = report.result,
    n = r.generation.length,
    capacity = report.settings.batteryKWh,
    max = Math.max(1, capacity),
    stride = Math.max(1, Math.floor(n / 400)),
    points = r.power.socKWh
      .filter((_, i) => i % stride === 0 || i === n)
      .map((v, j) => {
        const i = Math.min(j * stride, n);
        return `${(i / n) * 600},${110 - (v / max) * 95}`;
      })
      .join(" ");
  return (
    <figure>
      <svg
        viewBox="0 0 600 130"
        role="img"
        aria-label="Battery energy over mission; gold bands mark solar eclipses"
      >
        <rect width="600" height="120" fill="#0b131a" />
        {r.eclipseEvents.map((e, i) => (
          <rect
            key={i}
            x={(e.startIndex / n) * 600}
            width={Math.max(1, ((e.endIndex - e.startIndex) / n) * 600)}
            y="0"
            height="120"
            fill="#d9bd7d"
            opacity=".22"
          />
        ))}
        <line
          x1="0"
          x2="600"
          y1={110 - report.settings.reserveSoc * 95}
          y2={110 - report.settings.reserveSoc * 95}
          stroke="#e58b7b"
          strokeDasharray="4 3"
        />
        <polyline
          fill="none"
          stroke="#8ad2bd"
          strokeWidth="2"
          points={points}
        />
        <text x="4" y="12" fill="#dce5e9" fontSize="10">
          Battery kWh · reserve dashed · eclipse gold
        </text>
        <text x="4" y="127" fill="#dce5e9" fontSize="9">
          Start
        </text>
        <text x="530" y="127" fill="#dce5e9" fontSize="9">
          {report.settings.days} days
        </text>
      </svg>
      <figcaption>
        Finite mission, initial charge{" "}
        {(report.settings.initialSoc * 100).toFixed(0)}%. No guarantee beyond
        this window.
      </figcaption>
    </figure>
  );
}

const SETTING_HELP:Partial<Record<keyof EngineeringSettings,string>>={
 loadKW:'Constant total base demand. Energy consumed = kW × hours. Per-component additional loads are added to this number.',
 batteryKWh:'Usable stored energy, not power. A 100 kWh battery cannot supply 1 kW indefinitely: even ideal storage lasts only 100 hours without generation.',
 reserveSoc:'Minimum permitted fraction of usable capacity. A reserve of 0.2 means at least 20% must remain throughout the mission.',
 efficiency:'Fraction of sunlight converted to electricity. 0.25 means 25%, before system derating and storage losses.',
 derate:'Other generation losses, multiplied by efficiency. 0.8 retains 80%; it is not a measured performance prediction.',
 days:'Finite study duration starting at the UTC date above. Extend it to include nights and eclipses; a short successful window does not prove long-term sustainability.',
 initialSoc:'Fraction charged at the START. This energy must already be available; the model does not assume it is replenished each cycle.',
 maxLinkKm:'Maximum length for a tested straight corridor or radio hop. It does not establish routed cable distance or RF reliability.',
 exclusionKm:'Minimum selected pad–habitat spacing. This is a user planning rule, not a validated plume or debris safety distance.',
 maxOutageHours:'Longest allowed loss of geometric Earth access. Relays can help only if a valid path reaches an Earth-visible node.',
 footprintM:'Radius for nine common placement offsets. This samples sensitivity, not a probability of safe landing or a DEM error confidence interval.',
 maxSlopeDeg:'Facility-centre slope limit on available elevation data. It does not resolve rocks or certify an entire foundation.',
 chargeEfficiency:'Fraction of surplus electrical energy stored. 0.95 stores 95% and loses 5%.',
 dischargeEfficiency:'Fraction of removed battery energy delivered to the load. 0.95 delivers 95% and loses 5%.'
};
