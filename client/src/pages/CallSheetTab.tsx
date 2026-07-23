import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Printer } from "lucide-react";
import { useRef } from "react";

interface CallSheetTabProps {
  sessionId: number;
}

export function CallSheetTab({ sessionId }: CallSheetTabProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (printRef.current) {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(printRef.current.innerHTML);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Wristband / Call Sheet Generator</CardTitle>
          <CardDescription>
            Print QB wristband inserts and situational call sheets for game day.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button onClick={handlePrint} className="w-full" size="lg">
            <Printer className="mr-2 h-4 w-4" />
            Print Call Sheet
          </Button>

          <div ref={printRef} className="hidden">
            <div style={{ width: "8.5in", height: "11in", padding: "0.5in", fontFamily: "Arial, sans-serif", fontSize: "10px" }}>
              <h1 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "10px" }}>QB CALL SHEET</h1>

              {/* Wristband Section */}
              <div style={{ marginBottom: "20px", border: "2px solid black", padding: "10px" }}>
                <h2 style={{ fontSize: "12px", fontWeight: "bold" }}>WRISTBAND INSERTS</h2>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "10px" }}>
                  {["1st & 10", "2nd & Long", "3rd & Short", "Red Zone", "Goal Line", "2-Min Drill"].map((situation, i) => (
                    <div key={i} style={{ border: "1px solid gray", padding: "8px", textAlign: "center" }}>
                      <strong>{situation}</strong>
                      <div style={{ marginTop: "5px", fontSize: "9px" }}>
                        {situation === "1st & 10" && "Zone Run, Play Action"}
                        {situation === "2nd & Long" && "Quick Slant, Screen Pass"}
                        {situation === "3rd & Short" && "Power Run, Sneak"}
                        {situation === "Red Zone" && "Fade Route, Slant"}
                        {situation === "Goal Line" && "Power, Dive"}
                        {situation === "2-Min Drill" && "Hurry-Up Passes"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Situational Calls */}
              <div style={{ marginBottom: "20px", border: "2px solid black", padding: "10px" }}>
                <h2 style={{ fontSize: "12px", fontWeight: "bold" }}>SITUATIONAL CALLS</h2>
                <table style={{ width: "100%", marginTop: "10px", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid black" }}>
                      <th style={{ textAlign: "left", padding: "5px" }}>Situation</th>
                      <th style={{ textAlign: "left", padding: "5px" }}>Call</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { situation: "Blitz Look", call: "Hot Route Left" },
                      { situation: "Cover 2", call: "Seam Route" },
                      { situation: "Man Coverage", call: "Slant & Go" },
                      { situation: "Prevent Defense", call: "Dig Route" },
                    ].map((row, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #ddd" }}>
                        <td style={{ padding: "5px" }}>{row.situation}</td>
                        <td style={{ padding: "5px" }}>{row.call}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Key Reminders */}
              <div style={{ border: "2px solid black", padding: "10px" }}>
                <h2 style={{ fontSize: "12px", fontWeight: "bold" }}>KEY REMINDERS</h2>
                <ul style={{ marginTop: "8px", paddingLeft: "20px", fontSize: "9px" }}>
                  <li>Check safeties pre-snap</li>
                  <li>Audible if blitz shows</li>
                  <li>Protect hot receiver</li>
                  <li>Eyes on coverage, then throw</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Preview */}
          <Card className="bg-slate-50">
            <CardHeader>
              <CardTitle className="text-sm">Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs space-y-3 font-mono">
                <div className="border p-2 bg-white">
                  <strong>1st & 10:</strong> Zone Run, Play Action
                </div>
                <div className="border p-2 bg-white">
                  <strong>2nd & Long:</strong> Quick Slant, Screen Pass
                </div>
                <div className="border p-2 bg-white">
                  <strong>3rd & Short:</strong> Power Run, Sneak
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
