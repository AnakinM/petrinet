import type { JSX } from "react";
import { Canvas } from "@/flow/Canvas";
import { SAMPLE_NET } from "@/flow/sampleNet";

export default function App(): JSX.Element {
  return (
    <div className="h-screen w-screen">
      <Canvas net={SAMPLE_NET} />
    </div>
  );
}
