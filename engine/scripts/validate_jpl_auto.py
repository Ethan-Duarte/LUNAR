#!/usr/bin/env python3
"""Independently compare LUNAR science exports with JPL Horizons topocentric az/el.

Standard-library only. This script requests JPL's Sun (10) and Earth (399)
observer tables from the lunar coordinates / observer elevation recorded in
LUNAR v0.9 exports, caches original Horizons replies and writes CSV/JSON/MD.

Run from LUNAR project root:
  py scripts/validate_jpl_auto.py Study_*.json
On Windows PowerShell, if globs aren't expanded, list files explicitly.

Scientific scope: tests astronomical Sun/Earth pointing, NOT LOLA terrain
obstruction, illumination classification, event times or radio link budget.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path
import statistics
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

API = "https://ssd.jpl.nasa.gov/api/horizons.api"
MONTHS = {m: i for i, m in enumerate(
    ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"), 1)}


def as_utc(s: str) -> dt.datetime:
    return dt.datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(dt.timezone.utc)


def utc_str(date: dt.datetime) -> str:
    return date.strftime("%Y-%m-%dT%H:%M:%SZ")


def jd_utc(date: dt.datetime) -> float:
    return date.timestamp() / 86400.0 + 2440587.5


def wrap_deg(d: float) -> float:
    return (d + 180.0) % 360.0 - 180.0


def great_circle_deg(az1: float, el1: float, az2: float, el2: float) -> float:
    a1, e1, a2, e2 = (math.radians(v) for v in (az1, el1, az2, el2))
    cosine = (math.sin(e1) * math.sin(e2)
              + math.cos(e1) * math.cos(e2) * math.cos(a1 - a2))
    return math.degrees(math.acos(max(-1.0, min(1.0, cosine))))


def parse_horizons(raw: str):
    if "$$SOE" not in raw or "$$EOE" not in raw:
        raise ValueError("JPL response contains no ephemeris table: " + raw[:800].strip())
    head, table = raw.split("$$SOE", 1)
    table = table.split("$$EOE", 1)[0]
    if "Azimuth_(a-app)" not in head or "Elevation_(a-app)" not in head:
        raise ValueError("JPL quantities/columns are not the expected apparent azimuth/elevation")
    center = next((l.strip() for l in head.splitlines() if l.strip().startswith("Center pole/equ")), "")
    if not ("MEAN_ME" in center or "MOON_ME" in center):
        raise ValueError("JPL did not report the expected lunar mean-Earth frame: " + center)
    if "Atmos refraction: NO" not in head:
        raise ValueError("Horizons did not confirm AIRLESS atmosphere; do not compare uncritically")
    results = []
    for line in table.strip().splitlines():
        cols = next(csv.reader([line], skipinitialspace=True))
        if len(cols) < 5:
            continue
        stamp = cols[0].strip()
        # Example: "2026-Nov-14 00:00:00.000". Horizons may return
        # a final 59.999.. second from Julian date roundoff.
        try:
            left, fraction = stamp.split(".", 1)
            yr = int(left[0:4]); mo = MONTHS[left[5:8]]
            day = int(left[9:11]); hour = int(left[12:14]); minute = int(left[15:17]); second = int(left[18:20])
            micros = round(float("0." + fraction) * 1e6)
            when = dt.datetime(yr, mo, day, hour, minute, second, tzinfo=dt.timezone.utc) + dt.timedelta(microseconds=micros)
            az, el = float(cols[3]), float(cols[4])
        except (ValueError, IndexError, KeyError) as exc:
            raise ValueError(f"Unrecognized Horizons ephemeris row {line!r}") from exc
        results.append({"time": when, "az": az, "el": el})
    if not results:
        raise ValueError("Horizons response has a table but no parsed observations")
    return head, results


def build_params(lat: float, lon: float, altitude_km: float, times: list[dt.datetime], target: str):
    return {
        "format": "text",
        "COMMAND": f"'{target}'",
        "OBJ_DATA": "'NO'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'coord@301'",
        "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{lon:.8f},{lat:.8f},{altitude_km:.9f}'",
        "TLIST": "'" + " ".join(f"{jd_utc(t):.9f}" for t in times) + "'",
        "TIME_TYPE": "'UT'",
        "QUANTITIES": "'4'",
        "ANG_FORMAT": "'DEG'",
        "EXTRA_PREC": "'YES'",
        "CSV_FORMAT": "'YES'",
        "TIME_DIGITS": "'FRACSEC'",
        "APPARENT": "'AIRLESS'",
    }


def request_horizons(params: dict, cache_dir: Path, refresh: bool = False) -> tuple[str, str]:
    url = API + "?" + urlencode(params)
    cache = cache_dir / (hashlib.sha256(url.encode()).hexdigest()[:24] + ".txt")
    if cache.exists() and not refresh:
        return cache.read_text(encoding="utf-8"), url
    req = Request(url, headers={"User-Agent": "LUNAR-validation-research/0.1 (NASA-Space-Apps educational; Python urllib)"})
    try:
        with urlopen(req, timeout=100) as response:
            raw = response.read().decode("utf-8-sig", errors="replace")
    except (HTTPError, URLError, TimeoutError) as exc:
        raise RuntimeError(f"Could not fetch live JPL Horizons API: {exc}\n"
                           "Check internet access on this computer and retry. "
                           "No independent validation has been completed.") from exc
    if "$$SOE" not in raw:
        raise RuntimeError("Horizons returned an error, not an ephemeris:\n" + raw[:1600])
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache.write_text(raw, encoding="utf-8")
    return raw, url


def choose_samples(s: dict, maximum: int) -> list[dict]:
    rows = s["site"]["samples"]
    if not rows:
        raise ValueError("Study contains no time series")
    n = len(rows)
    ids = set(round(i * (n - 1) / max(1, maximum - 1)) for i in range(maximum))
    # Also capture interesting samples near modeled rise/set times.
    stamps = [as_utc(r["time"]) for r in rows]
    for event in s["site"].get("events", [])[:6]:
        ev = as_utc(event["time_utc"])
        ids.add(min(range(n), key=lambda i: abs((stamps[i]-ev).total_seconds())))
    ids.update((0, n-1))
    return [rows[i] for i in sorted(ids)]


def summarize(values: list[float]):
    if not values:
        return {"count": 0}
    return {"count": len(values), "rms_deg": math.sqrt(sum(x*x for x in values)/len(values)),
            "max_abs_deg": max(abs(x) for x in values),
            "mean_signed_deg": statistics.mean(values)}


def load_studies(paths):
    loaded = []
    for path in paths:
        data = json.loads(path.read_text(encoding="utf-8-sig"))
        site = data.get("site") or {}
        if not site.get("samples"):
            raise ValueError(f"{path}: missing site.samples")
        for key in ("lat", "lon", "elevation_m", "height_m"):
            if key not in site:
                raise ValueError(f"{path}: missing site.{key}")
        loaded.append((path, data))
    return loaded


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("studies", nargs="+", type=Path, help="LUNAR v0.9.0 exported JSON study files")
    p.add_argument("--samples-per-study", type=int, default=12,
                   help="Regularly spaced times per study, plus up to six rise/set samples (default 12)")
    p.add_argument("--output-dir", type=Path, default=Path("reports/jpl_validation"))
    p.add_argument("--refresh", action="store_true", help="Query JPL again rather than using identical cached requests")
    p.add_argument("--dry-run", action="store_true", help="Show expected JPL requests without network access")
    args = p.parse_args(argv)
    if args.samples_per_study < 2:
        p.error("--samples-per-study must be at least 2")
    all_studies = load_studies(args.studies)
    groups = defaultdict(dict)
    for path, study in all_studies:
        site = study["site"]
        lat, lon = float(site["lat"]), float(site["lon"]) % 360
        alt_km = (float(site["elevation_m"]) + float(site["height_m"])) / 1000.0
        key = (round(lat, 7), round(lon, 7), round(alt_km, 8))
        for r in choose_samples(study, args.samples_per_study):
            group_key = utc_str(as_utc(r["time"]))
            groups[key].setdefault(group_key, []).append((path.name, r))

    print(f"Loaded {len(all_studies)} study files; {len(groups)} independent lunar observer locations/heights.")
    total_requests = 2 * len(groups)
    print(f"Expected Horizons requests: {total_requests} (Sun and Earth per location/height).")
    if args.dry_run:
        for (lat, lon, alt), stamps in groups.items():
            print(f"  lat {lat:.5f}, lon {lon:.5f}, altitude {alt*1000:.3f} m; {len(stamps)} distinct epochs")
        return 0

    args.output_dir.mkdir(parents=True, exist_ok=True)
    cache_dir = args.output_dir / "raw_jpl"
    data_rows = []
    manifest = {"api": API, "queried_at_utc": utc_str(dt.datetime.now(dt.timezone.utc)),
                "studies": [str(x) for x in args.studies], "queries": [],
                "scope": "Independent Sun/Earth apparent topocentric azimuth/elevation only; NO LOLA terrain validation"}
    for key, stamp_to_rows in groups.items():
        lat, lon, alt_km = key
        times = sorted(as_utc(s) for s in stamp_to_rows)
        independent = {}
        for body, target in (("sun", "10"), ("earth", "399")):
            params = build_params(lat, lon, alt_km, times, target)
            print(f"Requesting JPL {body}: {lat:.5f} lat, {lon:.5f} E, {alt_km*1000:.3f} m; {len(times)} timestamps", flush=True)
            raw, url = request_horizons(params, cache_dir, args.refresh)
            head, parsed = parse_horizons(raw)
            if len(parsed) != len(times):
                raise RuntimeError(f"JPL returned {len(parsed)} dates but {len(times)} were requested: {url}")
            for requested, returned in zip(times, parsed):
                if abs((returned["time"] - requested).total_seconds()) > 1.0:
                    raise RuntimeError(f"Horizons timestamp mismatch for {body}: {requested} != {returned['time']}")
                independent[(body, utc_str(requested))] = returned
            manifest["queries"].append({"target": body, "lat_deg": lat, "lon_e_deg": lon,
                                        "altitude_km_above_reference_sphere": alt_km,
                                        "n_epochs": len(times), "url": url,
                                        "center_frame_line": next((l.strip() for l in head.splitlines()
                                                                   if l.strip().startswith("Center pole/equ")), "")})
            time.sleep(.65)
        for stamp, refs in stamp_to_rows.items():
            for studyname, row in refs:
                for body in ("sun", "earth"):
                    r = independent[(body, stamp)]
                    az = float(row[f"{body}_az"])
                    el = float(row[f"{body}_alt"])
                    data_rows.append({"study": studyname, "time_utc": stamp, "body": body,
                                      "lat_deg": lat, "lon_e_deg": lon, "observer_alt_m": alt_km*1000,
                                      "lunar_az_deg": az, "jpl_az_deg": r["az"],
                                      "az_error_deg": wrap_deg(az-r["az"]),
                                      "lunar_el_deg": el, "jpl_el_deg": r["el"],
                                      "el_error_deg": el-r["el"],
                                      "sky_sep_deg": great_circle_deg(az,el,r["az"],r["el"])})

    out = args.output_dir
    with (out / "angles_comparison.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(data_rows[0]))
        writer.writeheader()
        writer.writerows(data_rows)
    (out / "jpl_query_manifest.json").write_text(json.dumps(manifest, indent=2)+"\n",encoding="utf-8")
    statistics_by_group = {}
    for body in ("sun", "earth"):
        rows = [r for r in data_rows if r["body"] == body]
        statistics_by_group[body] = {field: summarize([r[field] for r in rows])
                                     for field in ("az_error_deg", "el_error_deg", "sky_sep_deg")}
    (out / "summary.json").write_text(json.dumps(statistics_by_group, indent=2)+"\n",encoding="utf-8")
    md = ["# LUNAR × JPL Horizons: independent pointing comparison", "",
          "**Scope:** Topocentric Sun and Earth pointing, azimuth clockwise from north and altitude above local tangent plane. "
          "This is *not* a validation of LOLA shading, sunrise/set terrain events, or radio links.", "",
          "| Body | N paired samples | RMS altitude error | Maximum altitude error | Maximum on-sky angular separation |",
          "|---|---:|---:|---:|---:|"]
    for body in ("sun", "earth"):
        row = statistics_by_group[body]
        md.append(f"| {body.title()} | {row['el_error_deg']['count']} | "
                  f"{row['el_error_deg']['rms_deg']:.6f}° | "
                  f"{row['el_error_deg']['max_abs_deg']:.6f}° | "
                  f"{row['sky_sep_deg']['max_abs_deg']:.6f}° |")
    md += ["", "## Reference provenance", "", f"JPL Horizons live API: {API}",
           "Queries, site altitudes, and center frame are recorded in `jpl_query_manifest.json`; original responses in `raw_jpl/`.",
           "LUNAR positions are from the supplied JSON exports; no fresh LUNAR SPICE computation was done.",
           "Horizons uses MOON mean-Earth coordinates, apparent airless az/el; matched site altitude is DEM elevation + observer instrument height.",
           "Horizons gravitational light deflection may differ minutely from LUNAR's SPICE LT+S approximation.",
           "", "## Interpretation", "", "A small angular error validates the astronomical pointing component only. "
           "Terrain horizon coverage, DEM interpolation, temporal event detection and map accuracy require separate checks.",
           "Results are not mission-certification claims. See https://ssd-api.jpl.nasa.gov/doc/horizons.html."]
    (out / "report.md").write_text("\n".join(md)+"\n",encoding="utf-8")
    print("\n" + "\n".join(md[:8]))
    print(f"\nWrote {out / 'report.md'}, {out / 'angles_comparison.csv'}, and cached raw JPL outputs")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, RuntimeError, OSError) as exc:
        print(f"\nValidation halted: {exc}", file=sys.stderr)
        raise SystemExit(2)
