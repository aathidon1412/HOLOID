import TopBar from "@/components/TopBar";
import MetricCard from "@/components/MetricCard";
import LiveIndicator from "@/components/LiveIndicator";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Activity, Bed, Wind, ArrowLeftRight } from "lucide-react";

const regions = [
  { name: "South Zone", general: 68, icu: 92, vent: 55, status: "ICU Alert", statusType: "critical" as const },
  { name: "North Zone", general: 54, icu: 71, vent: 44, status: "Normal", statusType: "vacant" as const },
  { name: "Central Zone", general: 81, icu: 87, vent: 78, status: "Warning", statusType: "warning" as const },
  { name: "East Zone", general: 43, icu: 39, vent: 31, status: "Normal", statusType: "vacant" as const },
];

const criticalHospitals = [
  { name: "North City Medical Inst.", occ: 96, icu: 2, status: "critical" as const },
  { name: "St. Adrian Trauma Center", occ: 94, icu: 4, status: "warning" as const },
  { name: "Mercy South General", occ: 92, icu: 3, status: "warning" as const },
  { name: "Riverside Emergency Hosp.", occ: 91, icu: 5, status: "warning" as const },
];

const GovCommandCenter = () => (
  <div>
    <TopBar title="Command Center" />
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <LiveIndicator />
        <span className="text-xs text-muted-foreground">14 Apr 2026 — 10:27 AM</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Region Occupancy" value="87%" subtitle="▲ +4.2% (Last 6 hours)" icon={<Activity size={20} />} status="critical">
          <p className="text-xs text-status-critical mt-1">⚠️ HIGH RISK</p>
        </MetricCard>
        <MetricCard title="Available ICU Beds" value="126" subtitle="Across 42 hospitals" icon={<Bed size={20} />} status="vacant">
          <p className="text-xs text-status-vacant mt-1">✓ Adequate</p>
        </MetricCard>
        <MetricCard title="Ventilator Utilization" value="73%" subtitle="Stable metro" icon={<Wind size={20} />} status="vacant">
          <p className="text-xs text-status-vacant mt-1">✓ OK</p>
        </MetricCard>
        <MetricCard title="Transfers In Progress" value="19" subtitle="5 marked urgent" icon={<ArrowLeftRight size={20} />} status="info">
          <p className="text-xs text-status-info mt-1">🔵 Ongoing</p>
        </MetricCard>
      </div>

      {/* Region Breakdown */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <h3 className="px-5 py-3 text-sm font-semibold text-foreground border-b border-border">Region Occupancy Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Region</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">General Occ.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">ICU Occ.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Ventilator</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {regions.map((r) => (
                <tr key={r.name} className="hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{r.name}</td>
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="h-1.5 w-16 rounded-full bg-muted"><div className={`h-1.5 rounded-full ${r.general >= 80 ? "bg-status-critical" : r.general >= 60 ? "bg-status-warning" : "bg-status-vacant"}`} style={{ width: `${r.general}%` }} /></div><span className="text-xs text-muted-foreground">{r.general}%</span></div></td>
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="h-1.5 w-16 rounded-full bg-muted"><div className={`h-1.5 rounded-full ${r.icu >= 80 ? "bg-status-critical" : r.icu >= 60 ? "bg-status-warning" : "bg-status-vacant"}`} style={{ width: `${r.icu}%` }} /></div><span className="text-xs text-muted-foreground">{r.icu}%</span></div></td>
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="h-1.5 w-16 rounded-full bg-muted"><div className={`h-1.5 rounded-full ${r.vent >= 80 ? "bg-status-critical" : r.vent >= 60 ? "bg-status-warning" : "bg-status-vacant"}`} style={{ width: `${r.vent}%` }} /></div><span className="text-xs text-muted-foreground">{r.vent}%</span></div></td>
                  <td className="px-4 py-3"><StatusBadge status={r.statusType} label={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Critical Hospitals */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <h3 className="px-5 py-3 text-sm font-semibold text-foreground border-b border-border">Critical Hospitals (≤ 5 ICU beds)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Hospital Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Occupancy</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">ICU Available</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {criticalHospitals.map((h) => (
                <tr key={h.name} className="hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{h.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{h.occ}%</td>
                  <td className="px-4 py-3"><StatusBadge status={h.status} label={`${h.icu} beds`} /></td>
                  <td className="px-4 py-3"><Button size="sm" variant="outline">Escalate</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
);

export default GovCommandCenter;
