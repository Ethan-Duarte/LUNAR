// Original LUNAR base markers. Displays the evaluated straight-line connections, colored by sampled terrain clearance.
import { useMemo, useRef } from "react";
import { Line, Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { sitePosKm } from "../lib/geo";
import type { Link } from "./engineering";
import type { Facility } from "./network";
const colors = {
  habitat: "#edf1ec",
  power: "#eac766",
  relay: "#83bce3",
  resource: "#a5c19b",
  landing: "#df9f8f",
};
export function BaseOverlay({
  facilities,
  links,
  elevation,
  onSelect,
}: {
  facilities: Facility[];
  links: Link[];
  elevation: (a: number, b: number) => number;
  onSelect: (id: string) => void;
}) {
  const drawn=useMemo(()=>links.flatMap(e=>{const a=facilities.find(f=>f.id===e.a),b=facilities.find(f=>f.id===e.b);return a&&b?[{...e,points:[sitePosKm(a.lat,a.lon,elevation(a.lat,a.lon)+a.mast),sitePosKm(b.lat,b.lon,elevation(b.lat,b.lon)+b.mast)]}]:[]}),[facilities,links,elevation]);
  return (
    <>
      {drawn.map((edge, i) => (
        <Line
          key={i}
          points={edge.points}
          color={edge.status === "clear" ? "#8acbb7" : edge.status === "blocked" ? "#e89688" : "#a7b0b7"}
          opacity={0.45}
          transparent
          dashed={edge.status !== "clear"}
          depthTest={false}
          dashSize={0.08}
          gapSize={0.08}
          lineWidth={1}
        />
      ))}
      {facilities.map((f) => (
        <FacilityMarker
          key={f.id}
          f={f}
          elevation={elevation}
          select={() => onSelect(f.id)}
        />
      ))}
    </>
  );
}
function FacilityMarker({
  f,
  elevation,
  select,
}: {
  f: Facility;
  elevation: (a: number, b: number) => number;
  select: () => void;
}) {
  const mesh = useRef<THREE.Mesh>(null),
    p = new THREE.Vector3(
      ...sitePosKm(f.lat, f.lon, elevation(f.lat, f.lon) + f.mast + 8),
    ),
    q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      p.clone().normalize(),
    );
  useFrame(({ camera }) => {
    if (mesh.current)
      mesh.current.scale.setScalar(
        Math.max(0.015, camera.position.distanceTo(p) * 0.008),
      );
  });
  return (
    <group position={p} quaternion={q}>
      <mesh
        ref={mesh}
        onClick={(e) => {
          e.stopPropagation();
          select();
        }}
      >
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={colors[f.role]} depthTest={false} />
      </mesh>
      <Html center distanceFactor={30} position={[0, 0.2, 0]}>
        <button className="base-scene-label" onClick={select}>
          {f.name} · {f.mast} m
        </button>
      </Html>
    </group>
  );
}
