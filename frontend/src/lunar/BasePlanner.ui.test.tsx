// @vitest-environment happy-dom
import { afterEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { BasePlanner } from "./BasePlanner";
import type { SiteAnalysis } from "../ui/useSiteAnalysis";
const onLocate = vi.fn(),
  source = {
    terrains: [],
    global: { width: 8, height: 4, h: new Float32Array(32) },
  };
const sourceOf = () => source;
const props = {
  active: { pin: { lat: 0, lon: 0 } } as SiteAnalysis,
  ready: true,
  sourceOf,
  ephem: null,
  windowStart: Date.parse("2026-11-14T00:00:00Z"),
  advanced: true,
  onLocate,
};
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});
it("lets a user add, rename and edit an array without leaving Base", () => {
  render(<BasePlanner {...props} />);
  fireEvent.change(screen.getByLabelText("New component"), {
    target: { value: "power" },
  });
  fireEvent.click(screen.getByText("Use selected observer"));
  expect(screen.getByLabelText("Array area (m²)")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "East array" },
  });
  expect(screen.getByRole("button", { name: /East array ·/ })).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Array area (m²)"), {
    target: { value: "42" },
  });
  expect(
    (screen.getByLabelText("Array area (m²)") as HTMLInputElement).value,
  ).toBe("42");
  fireEvent.click(screen.getByText("Inspect terrain ↗"));
  expect(onLocate).toHaveBeenCalledWith(0, 0, "East array");
  expect(screen.getByText("Design a place to operate.")).toBeTruthy();
});
it("recovers facilities and settings after remount instead of silently dropping the layout", () => {
  const first = render(<BasePlanner {...props} />);
  fireEvent.click(screen.getByText("Use selected observer"));
  fireEvent.change(screen.getByLabelText("Base demand (kW)"), {
    target: { value: "3.5" },
  });
  first.unmount();
  render(<BasePlanner {...props} />);
  expect(screen.getByRole("button", { name: /habitat 1 ·/ })).toBeTruthy();
  expect(
    (screen.getByLabelText("Base demand (kW)") as HTMLInputElement).value,
  ).toBe("3.5");
});
it("removes a facility and preserves complete project export controls", () => {
  render(<BasePlanner {...props} />);
  fireEvent.click(screen.getByText("Use selected observer"));
  fireEvent.click(screen.getByText("Remove"));
  expect(screen.queryByRole("button", { name: /habitat 1 ·/ })).toBeNull();
  expect(screen.getByText("Save complete base project ↓")).toBeTruthy();
});
it("restores saved alternative settings instead of retaining changed demand", () => {
  render(<BasePlanner {...props} />);
  fireEvent.click(screen.getByText("Use selected observer"));
  fireEvent.change(screen.getByLabelText("Base demand (kW)"), {
    target: { value: "2" },
  });
  fireEvent.click(screen.getByText("Keep alternative"));
  fireEvent.change(screen.getByLabelText("Base demand (kW)"), {
    target: { value: "8" },
  });
  fireEvent.click(screen.getByText("Restore complete scenario"));
  expect(
    (screen.getByLabelText("Base demand (kW)") as HTMLInputElement).value,
  ).toBe("2");
});

it("undoes and redoes facility placement without reloading the workspace", () => {
  render(<BasePlanner {...props} />);
  fireEvent.click(screen.getByText("Use selected observer"));
  fireEvent.click(screen.getByText("Undo facility edit"));
  expect(screen.queryByRole("button", { name: /habitat 1 ·/ })).toBeNull();
  fireEvent.click(screen.getByText("Redo"));
  expect(screen.getByRole("button", { name: /habitat 1 ·/ })).toBeTruthy();
});
it('walks through explicit placement and restores the previous draft',()=>{
 render(<BasePlanner {...props}/>);
 fireEvent.click(screen.getByText('Use selected observer'));
 fireEvent.change(screen.getByLabelText('Name'),{target:{value:'My original habitat'}});
 fireEvent.click(screen.getByText('Start guided Base lesson'));
 expect(screen.queryByRole('button',{name:/My original habitat ·/})).toBeNull();
 fireEvent.click(screen.getByText('Next step'));
 expect((screen.getByText('Next step') as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(screen.getByText('Use selected observer'));
 fireEvent.click(screen.getByText('Next step'));
 expect((screen.getByLabelText('New component') as HTMLSelectElement).value).toBe('power');
 fireEvent.click(screen.getByText('Use selected observer'));
 fireEvent.click(screen.getByText('Next step'));
 expect(screen.getByText('Evaluate and read the answer')).toBeTruthy();
 fireEvent.click(screen.getByText('Return to my design'));
 expect(screen.getByRole('button',{name:/My original habitat ·/})).toBeTruthy();
})
it('inspects by default and adds only once after selecting Add component',()=>{
 render(<BasePlanner {...props}/>);
 const map=screen.getByRole('img',{name:/Measured elevation base map/});
 vi.spyOn(map,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:320,height:320,right:320,bottom:320,x:0,y:0,toJSON:()=>({})});
 fireEvent.click(map,{clientX:160,clientY:160});
 expect(screen.queryByRole('button',{name:/habitat 1 ·/})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Add component',exact:true}));
 fireEvent.click(map,{clientX:160,clientY:160});
 expect(screen.getByRole('button',{name:/habitat 1 ·/})).toBeTruthy();
 fireEvent.click(map,{clientX:180,clientY:180});
 expect(screen.queryByRole('button',{name:/habitat 2 ·/})).toBeNull();
})
