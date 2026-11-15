// Original LUNAR portable observation-project validation. Validate before mutating live state.
export function observationProject(value: unknown) {
  const j = value as {
    schema?: string;
    pins?: { lat: number; lon: number; label?: string }[];
    time?: number;
    observer?: number;
    criteria?: { minSunFrac: number; earthMaskDeg: number };
    quality?: string;
    layer?: string;
  };
  if (
    j?.schema !== "lunar-project-1" ||
    !Array.isArray(j.pins) ||
    j.pins.length > 3 ||
    !Number.isFinite(j.time) ||
    j.pins.some((p) => !Number.isFinite(p.lat + p.lon) || Math.abs(p.lat) > 90)
  )
    throw Error("Not a valid LUNAR observation project");
  if (
    !Number.isFinite(j.observer) ||
    j.observer! < 0 ||
    j.observer! > 100 ||
    !j.criteria ||
    !Number.isFinite(j.criteria.minSunFrac + j.criteria.earthMaskDeg) ||
    j.criteria.minSunFrac < 0 ||
    j.criteria.minSunFrac > 1 ||
    j.criteria.earthMaskDeg < 0 ||
    j.criteria.earthMaskDeg > 15
  )
    throw Error("Invalid saved scientific assumptions");
  if (
    !["low", "medium", "high"].includes(j.quality ?? "") ||
    ![
      "natural",
      "elevation",
      "slope",
      "sunavg",
      "earthavg",
      "psr",
      "finder",
    ].includes(j.layer ?? "")
  )
    throw Error("Invalid saved display settings");
  return {
    ...j,
    pins: j.pins.map((p) => ({
      ...p,
      label: String(p.label ?? "Observation point").slice(0, 80),
    })),
    time: j.time!,
    observer: j.observer!,
    criteria: j.criteria,
    quality: j.quality as "low" | "medium" | "high",
    layer: j.layer as
      | "natural"
      | "elevation"
      | "slope"
      | "sunavg"
      | "earthavg"
      | "psr"
      | "finder",
  };
}
