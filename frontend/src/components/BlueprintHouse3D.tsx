"use client";

import dynamic from "next/dynamic";

const BlueprintHouseGL = dynamic(
  () => import("./BlueprintHouseGL").then((m) => m.BlueprintHouseGL),
  { ssr: false }
);

export function BlueprintHouse3D() {
  return <BlueprintHouseGL />;
}
