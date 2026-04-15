import TopBar from "@/components/TopBar";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Search, Plus } from "lucide-react";

const transfers = [
  { id: "TR-2048", patient: "Ravi Kumar", bed: "ICU", to: "Mercy General", status: "In Transit", eta: "9 min", by: "Dr. Sharma", time: "10:12 AM", statusType: "info" as const },
  { id: "TR-2041", patient: "Priya Nair", bed: "General", to: "Riverside Care", status: "Dispatched", eta: "22 min", by: "Dr. Mukherjee", time: "09:50 AM", statusType: "warning" as const },
  { id: "TR-2035", patient: "Anita Devi", bed: "ICU", to: "St. Helena Medical", status: "Requested", eta: "—", by: "Dr. Rajesh", time: "09:30 AM", statusType: "critical" as const },
];

const searchResults = [
  { name: "Mercy General Hospital", dist: "2.3 km", icu: 11, general: 27, vent: 8, region: "South Zone" },
  { name: "St. Helena Medical Center", dist: "4.7 km", icu: 8, general: 21, vent: 4, region: "South Zone" },
];

const AdminTransfers = () => (
  <div>
    <TopBar title="Transfers & Ambulance" />
    <div className="p-6 space-y-6">
      <div className="flex justify-end">
        <Button className="gap-2"><Plus size={16} /> Initiate New Transfer</Button>
      </div>

      {/* Search Panel */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Find Hospitals with Available Capacity</h3>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Need Bed Type</label>
            <select className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground">
              <option>ICU</option><option>General</option><option>Ventilator</option><option>Oxygen</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Region</label>
            <select className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground">
              <option>All</option><option>South Zone</option><option>North Zone</option><option>Central Zone</option>
            </select>
          </div>
          <Button variant="outline" className="gap-2"><Search size={14} /> Search Now</Button>
        </div>

        <div className="space-y-3">
          {searchResults.map((h) => (
            <div key={h.name} className="flex items-center justify-between rounded-md border border-border bg-background p-4">
              <div>
                <p className="text-sm font-medium text-foreground">{h.name}</p>
                <p className="text-xs text-muted-foreground">ICU: {h.icu} | General: {h.general} | Vent: {h.vent} — {h.region}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{h.dist} away</span>
                <Button size="sm">Select & Transfer</Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Transfers */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Active Transfers</h3>
        <div className="flex gap-2 flex-wrap">
          {["All", "Requested", "Dispatched", "In Transit", "Completed"].map((f) => (
            <button key={f} className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">{f}</button>
          ))}
        </div>
        <div className="space-y-3">
          {transfers.map((t) => (
            <div key={t.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">{t.id} • {t.patient}</span>
                  <StatusBadge status={t.statusType} label={t.status} />
                </div>
                <span className="text-xs text-muted-foreground">ETA: {t.eta}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t.bed} Bed • To: {t.to} • Requested by: {t.by} • {t.time}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">View Timeline</Button>
                <Button variant="outline" size="sm">Update Status</Button>
                <Button variant="outline" size="sm" className="text-status-critical hover:text-status-critical">Cancel</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default AdminTransfers;
