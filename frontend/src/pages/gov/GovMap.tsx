import { useMemo, useState } from "react";
import TopBar from "@/components/TopBar";

type MarkerStatus = "vacant" | "warning" | "critical";

const regions = [
  { name: "South Zone", hospitals: 12, status: "warning" as const },
  { name: "North Zone", hospitals: 8, status: "vacant" as const },
  { name: "Central Zone", hospitals: 10, status: "critical" as const },
  { name: "East Zone", hospitals: 6, status: "vacant" as const },
  { name: "West Zone", hospitals: 9, status: "warning" as const },
  { name: "North-East Zone", hospitals: 4, status: "vacant" as const },
];

const hospitalMarkers = [
  { x: 200, y: 180, name: "City General", pct: 47, status: "vacant" as const, region: "South Zone" },
  { x: 280, y: 120, name: "Metro City Hospital", pct: 93, status: "critical" as const, region: "Central Zone" },
  { x: 150, y: 100, name: "Apollo Medical", pct: 75, status: "warning" as const, region: "North Zone" },
  { x: 320, y: 200, name: "District General", pct: 94, status: "critical" as const, region: "Central Zone" },
  { x: 100, y: 220, name: "St. Mary's", pct: 40, status: "vacant" as const, region: "East Zone" },
  { x: 250, y: 250, name: "Mercy General", pct: 63, status: "vacant" as const, region: "South Zone" },
  { x: 180, y: 60, name: "Sunrise Medical", pct: 96, status: "critical" as const, region: "West Zone" },
  { x: 350, y: 80, name: "People's Hospital", pct: 90, status: "critical" as const, region: "South Zone" },
  { x: 90, y: 150, name: "North-East Community", pct: 33, status: "vacant" as const, region: "North-East Zone" },
];

const markerColors: Record<MarkerStatus, string> = {
  vacant: "#22C55E",
  warning: "#F59E0B",
  critical: "#EF4444",
};

const statusStyles: Record<MarkerStatus, { label: string; dotClass: string; chipClass: string }> = {
  vacant: {
    label: "Normal",
    dotClass: "status-dot-vacant",
    chipClass: "border border-status-vacant/30 bg-status-vacant/10 text-status-vacant",
  },
  warning: {
    label: "Warning",
    dotClass: "status-dot-maint",
    chipClass: "border border-status-warning/30 bg-status-warning/10 text-status-warning",
  },
  critical: {
    label: "Critical",
    dotClass: "status-dot-crit",
    chipClass: "border border-status-critical/30 bg-status-critical/10 text-status-critical",
  },
};

const GovMap = () => {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [hoveredMarker, setHoveredMarker] = useState<number | null>(null);

  const visibleMarkers = useMemo(() => {
    if (!selectedRegion) {
      return hospitalMarkers;
    }

    return hospitalMarkers.filter((marker) => marker.region === selectedRegion);
  }, [selectedRegion]);

  return (
    <div>
      <TopBar title="Regional Bed Map" />

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Regions</p>
            {regions.map((region) => {
              const style = statusStyles[region.status];
              const selected = selectedRegion === region.name;

              return (
                <button
                  key={region.name}
                  onClick={() => setSelectedRegion(selected ? null : region.name)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    selected
                      ? "border-primary bg-accent"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  <p className="text-sm font-medium text-foreground">{region.name}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">{region.hospitals} hospitals</p>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${style.chipClass}`}>
                      {style.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <svg viewBox="0 0 450 320" className="w-full" style={{ maxHeight: 500 }}>
              <path d="M50,50 L200,30 L350,50 L400,150 L380,280 L200,300 L80,270 L30,180 Z" fill="#1E2A38" stroke="#2E3D50" strokeWidth="2" />
              <path d="M120,80 L250,70 L300,120 L280,200 L150,210 L100,160 Z" fill="#253245" stroke="#2E3D50" strokeWidth="1" />
              <path d="M250,70 L380,60 L400,150 L340,180 L300,120 Z" fill="#253245" stroke="#2E3D50" strokeWidth="1" />

              {visibleMarkers.map((marker, index) => (
                <g
                  key={marker.name}
                  onMouseEnter={() => setHoveredMarker(index)}
                  onMouseLeave={() => setHoveredMarker(null)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={marker.x}
                    cy={marker.y}
                    r={hoveredMarker === index ? 10 : 7}
                    fill={markerColors[marker.status]}
                    opacity={0.85}
                    className="transition-all duration-200"
                  />
                  <circle cx={marker.x} cy={marker.y} r={3} fill="#F8FAFC" />
                  {hoveredMarker === index && (
                    <g>
                      <rect x={marker.x + 12} y={marker.y - 22} width={164} height={42} rx={6} fill="#111827" stroke="#334155" />
                      <text x={marker.x + 18} y={marker.y - 6} fill="#E2E8F0" fontSize="11" fontFamily="Inter, sans-serif">{marker.name}</text>
                      <text x={marker.x + 18} y={marker.y + 9} fill="#94A3B8" fontSize="10" fontFamily="Inter, sans-serif">{marker.region} · ICU Occupancy: {marker.pct}%</text>
                    </g>
                  )}
                </g>
              ))}
            </svg>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-6">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="status-dot status-dot-vacant" />
                Vacant
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="status-dot status-dot-maint" />
                Warning
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="status-dot status-dot-crit" />
                Critical
              </div>
            </div>

            {selectedRegion && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Showing hospitals in <span className="font-medium text-foreground">{selectedRegion}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GovMap;
