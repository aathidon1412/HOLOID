import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/button";

const alerts = [
  { type: "critical", icon: "🔴", title: "CRITICAL — ICU beds below threshold", desc: "Your hospital has 2 ICU beds remaining. Threshold: 2 beds. Immediate action recommended.", time: "09:07 AM" },
  { type: "info", icon: "🔵", title: "TRANSFER — Incoming patient confirmed", desc: "Ravi Kumar (ICU) arriving from City General in 9 min. Transfer ID: TR-2048", time: "10:34 AM" },
  { type: "warning", icon: "🟡", title: "MAINTENANCE — Ventilator servicing scheduled", desc: "3 ventilators in Ward B go offline at 14:00 today", time: "08:00 AM" },
];

const AdminAlerts = () => (
  <div>
    <TopBar title="Alerts & Notifications" />
    <div className="p-6 space-y-6">
      <div className="flex gap-2">
        {["All", "Critical", "Transfer", "System"].map((f) => (
          <button key={f} className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">{f}</button>
        ))}
      </div>

      <div className="space-y-3">
        {alerts.map((a, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{a.icon} {a.title}</p>
                <p className="text-xs text-muted-foreground">{a.desc}</p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{a.time}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">Dismiss</Button>
              {a.type === "critical" && <Button size="sm">Act Now</Button>}
              {a.type === "info" && <Button variant="outline" size="sm">Track</Button>}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Notification Preferences</h3>
        {["Email alerts for critical bed levels", "Email on transfer events", "In-app toast notifications"].map((label) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{label}</span>
            <div className="h-6 w-10 rounded-full bg-primary relative cursor-pointer">
              <div className="absolute right-0.5 top-0.5 h-5 w-5 rounded-full bg-primary-foreground transition-all" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default AdminAlerts;
