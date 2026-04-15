import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Check } from "lucide-react";

const hospitals = [
  { name: "Mercy General", dist: "2.3 km", icu: 11 },
  { name: "St. Helena", dist: "4.7 km", icu: 8 },
  { name: "Riverside Care", dist: "6.1 km", icu: 5 },
];

const DoctorRequestTransfer = () => {
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div>
      <TopBar title="Request Patient Transfer" />
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium ${step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {step > s ? <Check size={14} /> : s}
              </div>
              {s < 3 && <div className={`h-0.5 w-12 ${step > s ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <h3 className="font-semibold text-foreground">Step 1 — Patient Details</h3>
            <div className="space-y-3">
              <div className="space-y-2"><Label>Patient Name</Label><Input className="bg-secondary border-border" /></div>
              <div className="space-y-2"><Label>Patient ID (optional)</Label><Input className="bg-secondary border-border" /></div>
              <div className="space-y-2">
                <Label>Bed Required</Label>
                <select className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground">
                  <option>ICU</option><option>General</option><option>Ventilator</option><option>Oxygen</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end"><Button onClick={() => setStep(2)}>Next →</Button></div>
          </div>
        )}

        {step === 2 && (
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <h3 className="font-semibold text-foreground">Step 2 — Select Destination Hospital</h3>
            <Button variant="outline" className="w-full">Find Nearest Available Hospital Automatically</Button>
            <div className="text-center text-xs text-muted-foreground">— or —</div>
            <div className="space-y-2">
              {hospitals.map((h) => (
                <button key={h.name} onClick={() => setSelected(h.name)} className={`w-full flex items-center justify-between rounded-md border p-3 text-left transition-colors ${selected === h.name ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-accent"}`}>
                  <div>
                    <p className="text-sm font-medium text-foreground">{h.name}</p>
                    <p className="text-xs text-muted-foreground">{h.dist} — ICU: {h.icu} available</p>
                  </div>
                  {selected === h.name && <Check size={16} className="text-primary" />}
                </button>
              ))}
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
              <Button onClick={() => setStep(3)} disabled={!selected}>Next →</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <h3 className="font-semibold text-foreground">Step 3 — Review & Submit</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Patient:</span><span className="text-foreground">Ravi Kumar</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Bed Type:</span><span className="text-foreground">ICU</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">From:</span><span className="text-foreground">City General Hospital</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">To:</span><span className="text-foreground">{selected}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Est. Route:</span><span className="text-foreground">2.3 km • ~9 min</span></div>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>← Edit</Button>
              <Button>Confirm & Submit Request</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DoctorRequestTransfer;
