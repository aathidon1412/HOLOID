import TopBar from "@/components/TopBar";
import { MapPin } from "lucide-react";

const hospitals = [
  { name: "North City Medical Institute", region: "North Zone", icu: 2, icuTotal: 30, lat: 28.7, lng: 77.1, status: "critical" as const },
  { name: "Mercy General Hospital", region: "South Zone", icu: 11, icuTotal: 30, lat: 28.5, lng: 77.2, status: "vacant" as const },
  { name: "St. Helena Medical Center", region: "South Zone", icu: 4, icuTotal: 20, lat: 28.55, lng: 77.15, status: "warning" as const },
  { name: "Riverside Emergency Hospital", region: "Central Zone", icu: 5, icuTotal: 20, lat: 28.6, lng: 77.25, status: "warning" as const },
  { name: "Greenfield Community Hospital", region: "East Zone", icu: 18, icuTotal: 25, lat: 28.65, lng: 77.3, status: "vacant" as const },
];

const statusColors = {
  critical: "bg-status-critical",
  warning: "bg-status-warning",
  vacant: "bg-status-vacant",
};

const GovMap = () => (
  <div>
    <TopBar title="Regional Bed Map" />
    <div className="p-6 space-y-6">
      <div className="flex gap-4 items-center flex-wrap">
        <select className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground">
          <option>All Bed Types</option><option>ICU</option><option>General</option><option>Ventilator</option>
        </select>
        <select className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground">
          <option>All Regions</option><option>South Zone</option><option>North Zone</option><option>Central Zone</option><option>East Zone</option>
        </select>
      </div>

      {/* Map placeholder */}
      <div className="relative rounded-lg border border-border bg-card overflow-hidden" style={{ height: 400 }}>
        <div className="absolute inset-0 bg-muted/30 flex items-center justify-center">
          <div className="relative w-full h-full p-8">
            {hospitals.map((h, i) => (
              <div
                key={h.name}
                className="absolute group cursor-pointer"
                style={{ left: `${15 + i * 17}%`, top: `${20 + (i % 3) * 25}%` }}
              >
                <div className={`h-4 w-4 rounded-full ${statusColors[h.status]} shadow-lg`} />
                <div className="hidden group-hover:block absolute left-6 top-0 z-10 rounded-md border border-border bg-card p-3 shadow-lg whitespace-nowrap">
                  <p className="text-xs font-medium text-foreground">{h.name}</p>
                  <p className="text-xs text-muted-foreground">ICU: {h.icu} / {h.icuTotal}</p>
                  <p className="text-xs text-muted-foreground">{h.region}</p>
                </div>
              </div>
            ))}
            <p className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
              <MapPin size={20} className="mr-2" /> Interactive Map — Integration Planned
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-status-critical" /> Critical (≤2 beds)</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-status-warning" /> Warning (3–10 beds)</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-status-vacant" /> Available (&gt;10 beds)</span>
      </div>

      {/* Hospital list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {hospitals.map((h) => (
          <div key={h.name} className="rounded-lg border border-border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${statusColors[h.status]}`} />
              <p className="text-sm font-medium text-foreground">{h.name}</p>
            </div>
            <p className="text-xs text-muted-foreground">{h.region} — ICU: {h.icu} vacant / {h.icuTotal} total</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default GovMap;
