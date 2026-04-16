import { Fragment, useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer } from "react-leaflet";

import TopBar from "@/components/TopBar";
import { useSocket } from "@/hooks/useSocket";
import { govCommandCenterService, LiveFleetItem, RegionOccupancy } from "@/services/govCommandCenterService";

type FleetStatus = "active" | "waiting" | "critical";

const mapCenter: [number, number] = [20.5937, 78.9629];

const getFleetStatus = (item: LiveFleetItem): FleetStatus => {
  if (item.dispatchStatus === "pending_driver") return "waiting";
  if (item.transferStatus === "in_transit") return "active";
  return "critical";
};

const markerPalette: Record<FleetStatus, string> = {
  active: "#16a34a",
  waiting: "#f59e0b",
  critical: "#ef4444",
};

const occupancyClass = (region: RegionOccupancy) => {
  const icuRate = Number(region.occupancyRate?.icuBeds || 0);
  if (icuRate >= 0.9) return "border-status-critical/40 bg-status-critical/10 text-status-critical";
  if (icuRate >= 0.7) return "border-status-warning/40 bg-status-warning/10 text-status-warning";
  return "border-status-vacant/40 bg-status-vacant/10 text-status-vacant";
};

const GovMap = () => {
  const queryClient = useQueryClient();
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  const refreshLiveMap = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["gov-live-fleet"] });
    queryClient.invalidateQueries({ queryKey: ["gov-region-occupancy"] });
  }, [queryClient]);

  useSocket({ eventName: "dispatch-assigned", onEvent: refreshLiveMap });
  useSocket({ eventName: "dispatch-responded", onEvent: refreshLiveMap });
  useSocket({ eventName: "dispatch-progress-updated", onEvent: refreshLiveMap });
  useSocket({ eventName: "dispatch-location-updated", onEvent: refreshLiveMap });
  useSocket({ eventName: "bed-slot-status-changed", onEvent: refreshLiveMap });

  const { data: occupancyRegions = [] } = useQuery({
    queryKey: ["gov-region-occupancy"],
    queryFn: govCommandCenterService.getRegionOccupancySummary,
    refetchInterval: 30000,
  });

  const { data: liveFleetData } = useQuery({
    queryKey: ["gov-live-fleet"],
    queryFn: govCommandCenterService.getLiveFleet,
    refetchInterval: 15000,
  });

  const visibleMarkers = useMemo(() => {
    const fleet = liveFleetData?.fleet || [];

    if (!selectedRegion) {
      return fleet;
    }

    return fleet.filter((marker) => marker.toHospital?.region === selectedRegion);
  }, [liveFleetData?.fleet, selectedRegion]);

  return (
    <div>
      <TopBar title="Regional Bed Map" />

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Regions</p>
            {occupancyRegions.map((region) => {
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
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${occupancyClass(region)}`}>
                      ICU {(Number(region.occupancyRate?.icuBeds || 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="h-[520px] w-full overflow-hidden rounded-lg border border-border">
              <MapContainer center={mapCenter} zoom={5} scrollWheelZoom className="h-full w-full">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {visibleMarkers.map((item) => {
                  if (!item.marker) return null;

                  const status = getFleetStatus(item);
                  const color = markerPalette[status];

                  const linePath: [number, number][] = [];
                  if (item.fromHospital.coordinates) {
                    linePath.push([item.fromHospital.coordinates.lat, item.fromHospital.coordinates.lng]);
                  }
                  linePath.push([item.marker.lat, item.marker.lng]);
                  if (item.toHospital.coordinates) {
                    linePath.push([item.toHospital.coordinates.lat, item.toHospital.coordinates.lng]);
                  }

                  return (
                    <Fragment key={item.transferId}>
                      {linePath.length >= 2 && (
                        <Polyline
                          positions={linePath}
                          pathOptions={{ color, opacity: 0.45, weight: 3 }}
                        />
                      )}

                      <CircleMarker
                        center={[item.marker.lat, item.marker.lng]}
                        radius={8}
                        pathOptions={{ color: "#0f172a", weight: 1, fillColor: color, fillOpacity: 0.95 }}
                      >
                        <Popup>
                          <div className="space-y-1 text-xs">
                            <p className="font-semibold text-foreground">{item.ambulance.vehicleNumber || "Ambulance"}</p>
                            <p className="text-muted-foreground">Patient: {item.patientName}</p>
                            <p className="text-muted-foreground">{item.fromHospital.name} → {item.toHospital.name}</p>
                            <p className="text-muted-foreground">Dispatch: {item.dispatchStatus}</p>
                            <p className="text-muted-foreground">Workflow: {item.driverWorkflowStatus}</p>
                            <p className="text-muted-foreground">ETA: {item.etaToDestinationMin ?? "-"} min</p>
                            <p className="text-muted-foreground">Distance: {item.distanceToDestinationKm ?? "-"} km</p>
                          </div>
                        </Popup>
                      </CircleMarker>
                    </Fragment>
                  );
                })}
              </MapContainer>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-6">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-status-vacant" />
                In transit
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-status-warning" />
                Pending driver
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-status-critical" />
                Dispatch attention
              </div>
            </div>

            {selectedRegion && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Showing active fleet for <span className="font-medium text-foreground">{selectedRegion}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GovMap;
