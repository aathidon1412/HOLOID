import TopBar from "@/components/TopBar";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";

const transfers = [
  { id: "TR-2048", patient: "Ravi Kumar", bed: "ICU", to: "Mercy General Hospital", status: "In Transit", statusType: "info" as const, eta: "9 min", by: "you", time: "10:12 AM" },
  { id: "TR-2041", patient: "Priya Nair", bed: "General", to: "Riverside Care Institute", status: "Dispatched", statusType: "warning" as const, eta: "22 min", by: "Dr. Mukherjee", time: "09:50 AM" },
];

const timeline = [
  { time: "10:12 AM", status: "REQUESTED", desc: "Command center confirmed", done: true },
  { time: "10:21 AM", status: "DISPATCHED", desc: "Ambulance team assigned", done: true },
  { time: "10:34 AM", status: "IN TRANSIT", desc: "ETA 9 minutes", active: true },
  { time: "—", status: "COMPLETED", desc: "Awaiting arrival confirmation", done: false },
];

const DoctorTransfers = () => (
  <div>
    <TopBar title="Active Transfers" />
    <div className="p-6 space-y-6">
      <div className="flex gap-2">
        {["Mine Only", "All Hospital Transfers"].map((f) => (
          <button key={f} className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">{f}</button>
        ))}
      </div>

      <div className="space-y-3">
        {transfers.map((t) => (
          <div key={t.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-foreground">{t.id} — {t.patient} ({t.bed})</span>
                <StatusBadge status={t.statusType} label={t.status} />
              </div>
              <span className="text-xs text-muted-foreground">ETA: {t.eta}</span>
            </div>
            <p className="text-xs text-muted-foreground">To: {t.to} • Initiated by {t.by} • {t.time}</p>
            <Button variant="outline" size="sm">View Full Timeline</Button>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Transfer Timeline — TR-2048</h3>
        <div className="space-y-3">
          {timeline.map((t, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className={`mt-1 h-3 w-3 rounded-full ${t.done ? "bg-status-vacant" : t.active ? "bg-status-info pulse-live" : "bg-muted"}`} />
              <div>
                <p className="text-xs font-medium text-foreground">{t.time} — {t.status}</p>
                <p className="text-xs text-muted-foreground">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default DoctorTransfers;
