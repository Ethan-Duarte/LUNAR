// @vitest-environment happy-dom
import { it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
const fixtures = vi.hoisted(() => {
  const global = { width: 8, height: 4, h: new Float32Array(32) };
  const count = 105193,
    data = new Float32Array(count * 8);
  for (let i = 0; i < count; i++)
    data.set([Math.sqrt(0.75), 0.5, 0, 149597870.7, 1, 0, 0, 384400], i * 8);
  return {
    global,
    relief: { dem: global },
    ephem: {
      t0Ms: Date.parse("2024-01-01T00:00:00Z"),
      stepS: 3600,
      count,
      data,
      kernels: [],
    },
  };
});
vi.mock("./MissionScene",()=>({MissionScene:()=> <div>Expedition scene loaded</div>}));
vi.mock("../scene/MoonCanvas", () => ({ MoonCanvas: () => null }));
vi.mock("../scene/shading", async (original) => ({
  ...(await original<typeof import("../scene/shading")>()),
  useGlobeMap: () => null,
  useGlobeRelief: () => ({ relief: fixtures.relief, settled: true }),
}));
vi.mock("../lib/terrain", async (original) => {
  const m = await original<typeof import("../lib/terrain")>();
  return {
    ...m,
    loadTerrain: async () => ({
      radiusM: 1737400,
      frame: m.POLAR_FRAME,
      levels: [
        {
          size: 3,
          xMin: -1500,
          xMax: 1500,
          yMin: -1500,
          yMax: 1500,
          pixel: 1000,
          h: new Float32Array(9),
        },
      ],
    }),
    loadPatchIndex: async () => ({
      radiusM: 1737400,
      size: 0,
      pixelM: 0,
      patches: [],
    }),
  };
});
vi.mock("../lib/ephem", async (original) => {
  const m = await original<typeof import("../lib/ephem")>();
  return { ...m, loadEphem: async () => fixtures.ephem };
});
import {useStore} from "../store";
import App from "../App";
it("keeps Sites open when a historical location is selected", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) => ({
      ok: true,
      json: async () =>
        String(url).includes("manifest.json")
          ? { sites: [] }
          : [
              {
                id: "apollo-11",
                name: "Apollo 11",
                agency: "NASA",
                date_utc: "1969-07-20",
                lat: 0.674,
                lon: 23.473,
                status: "landed",
                source_url: "https://www.nasa.gov/mission/apollo-11/",
              },
            ],
    })),
  );
  render(<App />);
  await waitFor(
    () =>
      expect(
        screen.getByText("Measured terrain · JPL ephemerides"),
      ).toBeTruthy(),
    { timeout: 15000 },
  );
  fireEvent.click(screen.getByRole("button", { name: "Sites", exact: true }));
  fireEvent.click(screen.getByText("Study this location ↗"));
  expect(
    screen
      .getByRole("button", { name: "Sites", exact: true })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(screen.getByText("Explore the Moon’s history.")).toBeTruthy();
  const studyStart=useStore.getState().windowStart;
  fireEvent.change(screen.getByLabelText("Simulation UTC"),{target:{value:new Date(studyStart+100*86400000).toISOString().slice(0,16)}});
  expect(useStore.getState().windowStart).toBe(studyStart);
  cleanup();
  vi.unstubAllGlobals();
}, 30000);
