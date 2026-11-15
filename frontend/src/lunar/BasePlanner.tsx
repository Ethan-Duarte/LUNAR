// Original LUNAR connected-base prototype. Transparent geometric and sampled temporal screening.
import { useMemo, useState } from "react";
import type { SiteAnalysis } from "../ui/useSiteAnalysis";
import type { Ephem } from "../lib/ephem";
import { computeHorizon } from "../lib/horizon";
import { sourceHeight, type HeightSource } from "../lib/terrain";
import { upVector } from "../lib/geo";
import { computeSeries, hasComm, isSunlit } from "../lib/windows";
import { useStore } from "../store";
import { exportFile } from "./science";
import {
  layoutGeometry,
  lineOfSight,
  simultaneous,
  type Facility,
  type Role,
} from "./network";
const DAY = 86400000;
export function BasePlanner({
  active,
  ready,
  sourceOf,
  ephem,
  windowStart,
  advanced,
  onLocate,
}: {
  active?: SiteAnalysis;
  ready: boolean;
  sourceOf: (a: number, b: number) => HeightSource;
  ephem: Ephem | null;
  windowStart: number;
  advanced: boolean;
  onLocate: (a: number, b: number, label?: string) => void;
}) {
  const [facilities, setFacilities] = useState<Facility[]>([]),
    [role, setRole] = useState<Role>("habitat"),
    [maxLink, setMaxLink] = useState(10),
    [exclusion, setExclusion] = useState(2),
    [saved, setSaved] = useState<{ name: string; report: unknown }[]>([]),
    [message, setMessage] = useState("");
  const criteria = useStore((s) => s.criteria),
    height = useStore((s) => s.observerM);
  const physicalKey = JSON.stringify(
    facilities.map(({ id, role, lat, lon, mast }) => ({
      id,
      role,
      lat,
      lon,
      mast,
    })),
  );
  const geometry = useMemo(
    () => layoutGeometry(facilities, maxLink, exclusion),
    [physicalKey, maxLink, exclusion],
  );
  const temporal = useMemo(() => {
    if (!ephem || !ready || !facilities.length) return null;
    const results = facilities.map((f) => {
      const src = sourceOf(f.lat, f.lon),
        u = upVector(f.lat, f.lon),
        h = sourceHeight(src, ...u),
        horizon = computeHorizon(src, f.lat, f.lon, {
          observerHeightM: f.mast,
        });
      const series = computeSeries(
        ephem,
        horizon,
        h,
        windowStart,
        windowStart + 60 * DAY - 3600000,
        3600000,
      );
      return {
        f,
        series,
        sun: Array.from({ length: series.count }, (_, i) =>
          isSunlit(series, i, criteria),
        ),
        earth: Array.from({ length: series.count }, (_, i) =>
          hasComm(series, i, criteria),
        ),
      };
    });
    const power = results.filter((v) => v.f.role === "power"),
      hub = results.filter((v) => v.f.role === "habitat");
    const required = [...power.map((r) => r.sun), ...hub.map((r) => r.earth)];
    return {
      results: results.map((r) => ({
        id: r.f.id,
        sun: r.sun.filter(Boolean).length / r.sun.length,
        earth: r.earth.filter(Boolean).length / r.earth.length,
      })),
      concurrent: power.length && hub.length ? simultaneous(required) : null,
    };
  }, [physicalKey, criteria, ephem, ready, sourceOf, windowStart]);
  const links = useMemo(
    () =>
      geometry.tree.map((e) => ({
        ...e,
        ...lineOfSight(
          facilities.find((f) => f.id === e.a)!,
          facilities.find((f) => f.id === e.b)!,
          sourceOf(
            facilities.find((f) => f.id === e.a)!.lat,
            facilities.find((f) => f.id === e.a)!.lon,
          ),
        ),
      })),
    [geometry, physicalKey, sourceOf],
  );
  const report = {
    schema: "lunar-base-1",
    name: "Base layout " + (saved.length + 1),
    facilities,
    criteria,
    period: {
      start: new Date(windowStart).toISOString(),
      days: 60,
      step_hours: 1,
    },
    constraints: { maxLinkKm: maxLink, habitatPadExclusionKm: exclusion },
    geometry,
    links,
    temporal,
    limits: [
      "Geometric tree distances, not routed cable or rover paths.",
      "Sampled centreline terrain visibility, 20m step capped at 10000 segments; coarser DEM data remain coarser. No Fresnel zone or RF budget.",
      "Simultaneous metric requires all listed solar installations sunlit and all habitats Earth-visible; does not model power storage or relayed Earth access.",
      "Exclusion radius is user-selected, not a plume/debris safety prediction.",
      "Independent Earth-map holdout remains unresolved.",
    ],
  };
  function add() {
    if (!active) return;
    if (facilities.length >= 8) {
      setMessage("Eight facilities is the V1.0 screening limit.");
      return;
    }
    setFacilities((f) => [
      ...f,
      {
        id: crypto.randomUUID(),
        name: role + " " + (f.filter((x) => x.role === role).length + 1),
        role,
        lat: active.pin.lat,
        lon: active.pin.lon,
        mast: height,
      },
    ]);
    setMessage("");
  }
  async function open(file: File) {
    try {
      const j = JSON.parse(await file.text());
      if (
        j.schema !== "lunar-base-1" ||
        !Array.isArray(j.facilities) ||
        j.facilities.length > 8 ||
        j.facilities.some(
          (f: Facility) =>
            !Number.isFinite(f.lat + f.lon + f.mast) ||
            Math.abs(f.lat) > 90 ||
            f.mast < 0 ||
            f.mast > 100 ||
            !["habitat", "power", "resource", "relay", "landing"].includes(
              f.role,
            ),
        )
      )
        throw Error("Invalid base project");
      setFacilities(
        j.facilities.map((f: Facility) => ({
          ...f,
          id: crypto.randomUUID(),
          name: String(f.name).slice(0, 80),
        })),
      );
      setMessage(
        "Facilities loaded; results recomputed using current dates, terrain and assumptions.",
      );
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not open base project",
      );
    }
  }
  return (
    <>
      <p className="v1-eyebrow">CONNECTED BASE / FIRST ENGINEERING SCREEN</p>
      <h1>A base is a network.</h1>
      <p>
        Place observers in Observe, then assign facilities here. Compare nearby
        arrangements rather than unrelated best pixels.
      </p>
      <label className="v1-label">
        Facility role
        <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {(["habitat", "power", "resource", "relay", "landing"] as const).map(
            (r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ),
          )}
        </select>
      </label>
      <button className="v1-primary" disabled={!active || !ready} onClick={add}>
        Assign selected observer to layout
      </button>
      {!active && (
        <p className="v1-note">
          Place an observer first. Add several locations to assemble a layout.
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <div className="v1-fields">
        <label>
          Maximum link length km
          <input
            type="number"
            min="0"
            value={maxLink}
            onChange={(e) => setMaxLink(Math.max(0, +e.target.value))}
          />
        </label>
        <label>
          Pad–habitat exclusion km
          <input
            type="number"
            min="0"
            value={exclusion}
            onChange={(e) => setExclusion(Math.max(0, +e.target.value))}
          />
        </label>
      </div>
      {facilities.map((f) => (
        <article className="v1-facility" key={f.id}>
          <input
            aria-label={"Facility name " + f.id}
            value={f.name}
            onChange={(e) =>
              setFacilities((a) =>
                a.map((q) =>
                  q.id === f.id ? { ...q, name: e.target.value } : q,
                ),
              )
            }
          />
          <p>
            {f.role} · {f.lat.toFixed(4)}°, {f.lon.toFixed(4)}° · {f.mast} m
          </p>
          <button onClick={() => onLocate(f.lat, f.lon, f.name)}>
            Show location ↗
          </button>
          <button
            onClick={() => setFacilities((a) => a.filter((q) => q.id !== f.id))}
          >
            Remove
          </button>
        </article>
      ))}
      {facilities.length > 0 && (
        <>
          <h2>Layout report</h2>
          <div className="v1-metrics">
            <div>
              <small>Shortest tree</small>
              <strong>{geometry.totalKm.toFixed(2)} km</strong>
            </div>
            <div>
              <small>Longest separation</small>
              <strong>{geometry.maxSpanKm.toFixed(2)} km</strong>
            </div>
            <div>
              <small>Exclusion conflicts</small>
              <strong>{geometry.conflicts.length}</strong>
            </div>
          </div>
          <p className={geometry.connected ? "v1-note" : "v1-alert"}>
            {geometry.connected
              ? "All facilities can be joined within the selected geometric link limit."
              : "This arrangement requires at least one connection longer than the selected limit."}
          </p>
          {geometry.conflicts.length > 0 && (
            <p className="v1-alert">
              A landing facility violates the selected habitat separation. This
              is a planning constraint, not a physical hazard calculation.
            </p>
          )}
          <table className="v1-table">
            <thead>
              <tr>
                <th>Connection</th>
                <th>Arc km</th>
                <th>Terrain LOS</th>
              </tr>
            </thead>
            <tbody>
              {links.map((e) => (
                <tr key={e.a + e.b}>
                  <td>
                    {facilities.find((f) => f.id === e.a)?.name} →{" "}
                    {facilities.find((f) => f.id === e.b)?.name}
                  </td>
                  <td>{e.km.toFixed(2)}</td>
                  <td>
                    {e.status}
                    {advanced && e.minClearanceM !== null ? (
                      <small> {e.minClearanceM.toFixed(1)} m min</small>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="v1-note">
            Shortest tree uses surface arc distances. LOS checks straight
            segments against the available DEM chain; clear does not establish a
            reliable RF link. Links exceeding detailed patch coverage use
            coarser terrain.
          </p>
          <h2>Simultaneous operations</h2>
          <p>
            {temporal?.concurrent !== null && temporal?.concurrent !== undefined
              ? (temporal.concurrent * 100).toFixed(1) +
                "% of hourly samples have all power sites sunlit and all habitats directly Earth-visible."
              : "Add at least one habitat and one power installation to evaluate overlapping availability."}
          </p>
          <p className="v1-note">
            60 shared days. This metric does not model storage, loads, relays or
            operational sufficiency. Relay facilities currently participate in
            the geometric layout, not automatic relay routing.
          </p>
          <div className="v1-actions">
            <button
              onClick={() =>
                setSaved((a) => [
                  ...a,
                  {
                    name: "Layout " + (a.length + 1),
                    report: JSON.parse(JSON.stringify(report)),
                  },
                ])
              }
            >
              Keep layout for comparison
            </button>
            <button
              onClick={() =>
                exportFile("LUNAR-base.json", JSON.stringify(report, null, 2))
              }
            >
              Save base project ↓
            </button>
          </div>
        </>
      )}
      <label className="v1-upload">
        Open a base project
        <input
          type="file"
          accept="application/json,.json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void open(f);
            e.target.value = "";
          }}
        />
      </label>
      {saved.length > 0 && (
        <>
          <h2>Saved alternatives</h2>
          {saved.map((s, i) => {
            const r = s.report as typeof report;
            return (
              <article className="v1-facility" key={i}>
                <h3>{s.name}</h3>
                <p>
                  {r.facilities.length} facilities ·{" "}
                  {r.geometry.totalKm.toFixed(2)} km tree ·{" "}
                  {r.geometry.conflicts.length} conflicts
                </p>
                <button
                  onClick={() =>
                    exportFile(
                      "LUNAR-" + s.name + ".json",
                      JSON.stringify(s.report, null, 2),
                    )
                  }
                >
                  Export snapshot ↓
                </button>
                <button
                  onClick={() => {
                    setFacilities(r.facilities);
                    setMaxLink(r.constraints.maxLinkKm);
                    setExclusion(r.constraints.habitatPadExclusionKm);
                  }}
                >
                  Restore facilities
                </button>
              </article>
            );
          })}
          <p className="v1-note">
            Snapshots retain their original dates and assumptions; restoring
            facilities recalculates under current settings. Export snapshots
            before closing the page.
          </p>
        </>
      )}
      <details className="v1-detail">
        <summary>What this prototype does not establish</summary>
        {report.limits.map((v) => (
          <p key={v}>{v}</p>
        ))}
      </details>
    </>
  );
}
