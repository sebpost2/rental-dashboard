"use client";

import { Suspense, useMemo, useState } from "react";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Edges, Grid, ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";

const W = 3.2;
const D = 2.0;
const H = 1.9;
const ROOF_RISE = 1.05;

function useRoofGeometry() {
  return useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-W / 2 - 0.15, 0);
    shape.lineTo(0, ROOF_RISE);
    shape.lineTo(W / 2 + 0.15, 0);
    shape.lineTo(-W / 2 - 0.15, 0);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: D + 0.3,
      bevelEnabled: false,
    });
    geo.translate(0, H, -(D + 0.3) / 2);
    return geo;
  }, []);
}

function House() {
  const roofGeo = useRoofGeometry();

  const glassProps = {
    transparent: true,
    opacity: 0.24,
    roughness: 0.12,
    metalness: 0.05,
    envMapIntensity: 1.4,
    side: THREE.DoubleSide,
  } as const;

  return (
    <group>
      {/* walls */}
      <mesh position={[0, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} />
        <meshPhysicalMaterial color="#0f2942" {...glassProps} />
        <Edges scale={1} color="#c9974a" />
      </mesh>

      {/* roof */}
      <mesh geometry={roofGeo} castShadow>
        <meshPhysicalMaterial color="#3d6e9e" {...glassProps} opacity={0.3} />
        <Edges scale={1} threshold={20} color="#c9974a" />
      </mesh>

      {/* door */}
      <mesh position={[0, 0.55, D / 2 + 0.005]}>
        <boxGeometry args={[0.55, 1.1, 0.01]} />
        <meshBasicMaterial transparent opacity={0} />
        <Edges color="#efead9" />
      </mesh>

      {/* windows */}
      <mesh position={[-0.85, 0.95, D / 2 + 0.005]}>
        <boxGeometry args={[0.5, 0.5, 0.01]} />
        <meshBasicMaterial transparent opacity={0} />
        <Edges color="#efead9" />
      </mesh>
      <mesh position={[0.85, 0.95, D / 2 + 0.005]}>
        <boxGeometry args={[0.5, 0.5, 0.01]} />
        <meshBasicMaterial transparent opacity={0} />
        <Edges color="#efead9" />
      </mesh>

    </group>
  );
}

function Scene({ reducedMotion }: { reducedMotion: boolean }) {
  const [interacting, setInteracting] = useState(false);

  return (
    <>
      <ambientLight intensity={0.55} color="#8fb3d9" />
      <directionalLight
        position={[3, 4.5, 2.5]}
        intensity={1.6}
        color="#fff3da"
        castShadow
        shadow-mapSize={[512, 512]}
      />
      <pointLight position={[-3, 1.5, -2.5]} intensity={0.5} color="#5a93c4" />

      <House />

      <Grid
        position={[0, 0, 0]}
        args={[10, 10]}
        cellSize={0.4}
        cellThickness={0.5}
        cellColor="#ffffff"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#c9974a"
        fadeDistance={9}
        fadeStrength={1.3}
        infiniteGrid
      />
      <ContactShadows position={[0, 0.005, 0]} opacity={0.45} scale={8} blur={2.2} far={3} />

      <Environment preset="city" background={false} environmentIntensity={0.6} />

      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minPolarAngle={Math.PI * 0.12}
        maxPolarAngle={Math.PI * 0.82}
        autoRotate={!reducedMotion && !interacting}
        autoRotateSpeed={0.7}
        onStart={() => setInteracting(true)}
        onEnd={() => setInteracting(false)}
        target={[0, H / 2 + 0.3, 0]}
      />
    </>
  );
}

export function BlueprintHouseGL() {
  const reducedMotion = useReducedMotion();

  return (
    <div
      className="relative mx-auto h-full max-h-130 min-h-72 w-full max-w-lg"
      style={{ cursor: reducedMotion ? "default" : "grab" }}
    >
      <div
        className="pointer-events-none absolute top-6 left-1/2 z-10 -translate-x-1/2 rounded-sm px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.04em] whitespace-nowrap"
        style={{ background: "var(--brass)", color: "var(--ink)" }}
      >
        NETO +2,140.00
      </div>
      <Canvas
        shadows
        gl={{ alpha: true, antialias: true }}
        camera={{ position: [5.5, 6.6, 6.5], fov: 30 }}
        dpr={[1, 1.75]}
      >
        <Suspense fallback={null}>
          <Scene reducedMotion={reducedMotion} />
        </Suspense>
      </Canvas>
    </div>
  );
}
