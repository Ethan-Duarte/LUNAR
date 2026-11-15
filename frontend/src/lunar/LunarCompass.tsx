// Original LUNAR viewport bearings; generated SVG indicators, no borrowed artwork.
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { unit, type Vec3 } from "../lib/geo";
const p = new THREE.Vector3();
export function LunarCompass({ sun, earth }: { sun: Vec3; earth: Vec3 }) {
  useFrame(({ camera, size }) => {
    for (const [name, v, d] of [
      ["sun", sun, 19000],
      ["earth", earth, 13000],
    ] as const) {
      const el = document.getElementById("lunar-bearing-" + name);
      if (!el) continue;
      const u = unit(v);
      p.set(u[0] * d, u[1] * d, u[2] * d).project(camera);
      let x = p.x,
        y = -p.y;
      if (p.z > 1) {
        x = -x;
        y = -y;
      }
      const k = Math.max(1, Math.abs(x), Math.abs(y));
      x = (x / k) * (size.width / 2 - 65);
      y = (y / k) * (size.height / 2 - 95);
      el.style.left = `${size.width / 2 + x}px`;
      el.style.top = `${size.height / 2 + y}px`;
      el.style.setProperty("--bearing", Math.atan2(y, x) + "rad");
      el.dataset.show = "true";
    }
  });
  return null;
}
