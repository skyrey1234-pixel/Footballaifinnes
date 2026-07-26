import Play3DVisualizer from "@/components/play3d/Play3DVisualizer";

/** Dev-only visual test harness for the upgraded 3D simulator (no auth required). */
export default function Sim3DTest() {
  if (!import.meta.env.DEV) return <div className="p-8 text-gray-400">Not available.</div>;
  return (
    <div className="min-h-screen bg-[#0D1117] p-6 space-y-4">
      <h1 className="text-white font-bold">3D Simulator Test Harness (dev only)</h1>
      <Play3DVisualizer
        formation="Shotgun Trips Right"
        playName="Test — Trips Flood w/ Breakdown Paths"
        playType="pass"
        target="Y"
        defenseScheme="4-3"
        height={460}
        showBall
        annotations={[
          { kind: "wrong", x: 62, y: 44, label: "BREAKDOWN" },
          { kind: "right", x: 44, y: 34, label: "EXECUTE HERE" },
        ]}
        wrongPath={[[50, 50], [56, 46], [63, 42]]}
        correctPath={[[50, 50], [45, 42], [42, 32]]}
      />
    </div>
  );
}
