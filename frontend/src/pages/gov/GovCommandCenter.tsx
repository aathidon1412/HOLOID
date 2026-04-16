import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import TopBar from "@/components/TopBar";
import MetricCard from "@/components/MetricCard";
import LiveIndicator from "@/components/LiveIndicator";
import StatusBadge from "@/components/StatusBadge";
import { Activity, Bed, Wind, ArrowLeftRight } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { govCommandCenterService } from "@/services/govCommandCenterService";

const statusByIcuRate = (icuRate: number) => {
  if (icuRate >= 0.9) return { status: "critical" as const, label: "ICU Alert" };
  if (icuRate >= 0.7) return { status: "warning" as const, label: "Warning" };
  return { status: "vacant" as const, label: "Normal" };
};

const GovCommandCenter = () => {
  const queryClient = useQueryClient();

  const refreshLiveData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["gov-command-center-occupancy"] });
    queryClient.invalidateQueries({ queryKey: ["gov-command-center-critical"] });
    queryClient.invalidateQueries({ queryKey: ["gov-command-center-fleet"] });
  }, [queryClient]);

  useSocket({ eventName: "dispatch-assigned", onEvent: refreshLiveData });
  useSocket({ eventName: "dispatch-responded", onEvent: refreshLiveData });
  useSocket({ eventName: "dispatch-progress-updated", onEvent: refreshLiveData });
  useSocket({ eventName: "dispatch-location-updated", onEvent: refreshLiveData });
  useSocket({ eventName: "bed-slot-status-changed", onEvent: refreshLiveData });

  const { data: regions = [] } = useQuery({
    queryKey: ["gov-command-center-occupancy"],
    queryFn: govCommandCenterService.getRegionOccupancySummary,
    refetchInterval: 30000,
  });

  const { data: criticalHospitals = [] } = useQuery({
    queryKey: ["gov-command-center-critical"],
    queryFn: () => govCommandCenterService.getCriticalHospitals(5),
    refetchInterval: 30000,
  });

  const { data: fleetData } = useQuery({
    queryKey: ["gov-command-center-fleet"],
    queryFn: govCommandCenterService.getLiveFleet,
    refetchInterval: 15000,
  });

  const regionTotals = useMemo(() => {
    const baseline = {
      totalCapacity: 0,
      totalAvailable: 0,
      availableIcuBeds: 0,
      totalVentilatorCapacity: 0,
      availableVentilatorBeds: 0,
      hospitals: 0,
    };

    return regions.reduce((acc, region) => {
      const capacity =
        Number(region.totalCapacity.generalBeds || 0) +
        Number(region.totalCapacity.icuBeds || 0) +
        Number(region.totalCapacity.ventilatorBeds || 0);

      const available =
        Number(region.available.generalBeds || 0) +
        Number(region.available.icuBeds || 0) +
        Number(region.available.ventilatorBeds || 0);

      acc.totalCapacity += capacity;
      acc.totalAvailable += available;
      acc.availableIcuBeds += Number(region.available.icuBeds || 0);
      acc.totalVentilatorCapacity += Number(region.totalCapacity.ventilatorBeds || 0);
      acc.availableVentilatorBeds += Number(region.available.ventilatorBeds || 0);
      acc.hospitals += Number(region.hospitals || 0);
      return acc;
    }, baseline);
  }, [regions]);

  const totalOccupancyPercent =
    regionTotals.totalCapacity > 0
      ? Math.round((1 - regionTotals.totalAvailable / regionTotals.totalCapacity) * 100)
      : 0;

  const ventilatorUtilizationPercent =
    regionTotals.totalVentilatorCapacity > 0
      ? Math.round(
          (1 - regionTotals.availableVentilatorBeds / regionTotals.totalVentilatorCapacity) * 100
        )
      : 0;

  return (
    <div>
      <TopBar title="Command Center" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <LiveIndicator />
          <span className="text-xs text-muted-foreground">{new Date().toLocaleString()}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Region Occupancy"
            value={`${totalOccupancyPercent}%`}
            subtitle={`${regions.length} monitored regions`}
            icon={<Activity size={20} />}
            status={totalOccupancyPercent >= 85 ? "critical" : totalOccupancyPercent >= 70 ? "warning" : "vacant"}
          />
          <MetricCard
            title="Available ICU Beds"
            value={String(regionTotals.availableIcuBeds)}
            subtitle={`Across ${regionTotals.hospitals} hospitals`}
            icon={<Bed size={20} />}
            status={regionTotals.availableIcuBeds <= 25 ? "critical" : "vacant"}
          />
          <MetricCard
            title="Ventilator Utilization"
            value={`${ventilatorUtilizationPercent}%`}
            subtitle={`${regionTotals.availableVentilatorBeds} beds currently free`}
            icon={<Wind size={20} />}
            status={ventilatorUtilizationPercent >= 80 ? "warning" : "vacant"}
          />
          <MetricCard
            title="Transfers In Progress"
            value={String(fleetData?.metrics.activeTransfers || 0)}
            subtitle={`${fleetData?.metrics.inTransit || 0} in transit • ${fleetData?.metrics.awaitingDriver || 0} awaiting driver`}
            icon={<ArrowLeftRight size={20} />}
            status="info"
          />
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <h3 className="px-5 py-3 text-sm font-semibold text-foreground border-b border-border">
            Region Occupancy Breakdown
          </h3>
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
                {regions.map((r) => {
                  const generalPct = Math.round(Number(r.occupancyRate.generalBeds || 0) * 100);
                  const icuPct = Math.round(Number(r.occupancyRate.icuBeds || 0) * 100);
                  const ventPct = Math.round(Number(r.occupancyRate.ventilatorBeds || 0) * 100);
                  const status = statusByIcuRate(Number(r.occupancyRate.icuBeds || 0));

                  return (
                    <tr key={r.region} className="hover:bg-accent/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{r.region}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 rounded-full bg-muted">
                            <div
                              className={`h-1.5 rounded-full ${generalPct >= 80 ? "bg-status-critical" : generalPct >= 60 ? "bg-status-warning" : "bg-status-vacant"}`}
                              style={{ width: `${generalPct}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{generalPct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 rounded-full bg-muted">
                            <div
                              className={`h-1.5 rounded-full ${icuPct >= 80 ? "bg-status-critical" : icuPct >= 60 ? "bg-status-warning" : "bg-status-vacant"}`}
                              style={{ width: `${icuPct}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{icuPct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 rounded-full bg-muted">
                            <div
                              className={`h-1.5 rounded-full ${ventPct >= 80 ? "bg-status-critical" : ventPct >= 60 ? "bg-status-warning" : "bg-status-vacant"}`}
                              style={{ width: `${ventPct}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{ventPct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={status.status} label={status.label} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <h3 className="px-5 py-3 text-sm font-semibold text-foreground border-b border-border">
            Critical Hospitals (≤ 5 ICU beds)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Hospital Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Region</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">ICU Available</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Critical Types</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {criticalHospitals.map((hospital) => {
                  const icuBeds = Number(hospital.resources?.icuBeds || 0);
                  const status = icuBeds <= 2 ? "critical" : "warning";

                  return (
                    <tr key={hospital._id} className="hover:bg-accent/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{hospital.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{hospital.region || "UNKNOWN"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={status} label={`${icuBeds} beds`} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {hospital.criticalTypes.join(", ") || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GovCommandCenter;
