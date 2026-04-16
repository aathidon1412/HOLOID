import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import TopBar from "@/components/TopBar";
import MetricCard from "@/components/MetricCard";
import OccupancyBar from "@/components/OccupancyBar";
import LiveIndicator from "@/components/LiveIndicator";
import { Bed, Wind, HeartPulse, Droplets } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/hooks/useSocket";
import axiosInstance from "@/api/axiosInstance";

const defaultActivity = [
  { time: "10:34 AM", msg: "Ward A ICU: 1 bed now occupied" },
  { time: "10:21 AM", msg: "Ward B General: 2 beds cleared to vacant" },
  { time: "09:55 AM", msg: "Ward C Ventilator: 1 moved to maintenance" },
];

type BedType = "ICU" | "General" | "Ventilator" | "Oxygen-supported";

type WardBed = {
  type: BedType;
  status: string;
  count: number;
};

type ResourceWard = {
  wardName: string;
  beds: WardBed[];
};

type ResourceInventory = {
  hospital?: { _id?: string; name?: string } | string;
  region?: string;
  wards?: ResourceWard[];
  updatedAt?: string;
};

type BedSlotPayload = {
  hospitalId?: string;
  lifecycleEvent?: string;
  bedSlot?: {
    wardName?: string;
    slotLabel?: string;
    bedType?: string;
    status?: string;
  };
};

type TransferEventPayload = {
  hospitalId?: string;
  transfer?: {
    _id?: string;
    patientName?: string;
    status?: string;
  };
};

const DoctorOverview = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activity, setActivity] = useState(defaultActivity);
  const [selectedBedCategory, setSelectedBedCategory] = useState<"icu" | "general" | "ventilator" | "oxygen">("icu");

  const { data: inventory, isLoading } = useQuery({
    queryKey: ["resources", user?.hospital],
    queryFn: async () => {
      if (!user?.hospital) throw new Error("No hospital assigned");
      const res = await axiosInstance.get("/resources", {
        params: { hospitalId: user.hospital },
      });

      const resources: ResourceInventory[] =
        res?.data?.data ||
        res?.data?.resources ||
        [];

      return resources[0] || null;
    },
    enabled: !!user?.hospital,
  });

  const hospitalName = useMemo(() => {
    if (!inventory?.hospital) return "My Hospital";
    if (typeof inventory.hospital === "string") return "My Hospital";
    return inventory.hospital.name || "My Hospital";
  }, [inventory?.hospital]);

  const regionLabel = useMemo(() => inventory?.region || "Unknown Region", [inventory?.region]);

  const metrics = useMemo(() => {
    const summary = {
      icu: { occupied: 0, vacant: 0, total: 0 },
      general: { occupied: 0, vacant: 0, total: 0 },
      ventilator: { occupied: 0, vacant: 0, total: 0 },
      oxygen: { occupied: 0, vacant: 0, total: 0 },
    };

    for (const ward of inventory?.wards || []) {
      for (const bed of ward.beds || []) {
        const count = Number(bed.count || 0);
        let key: keyof typeof summary | null = null;

        if (bed.type === "ICU") key = "icu";
        if (bed.type === "General") key = "general";
        if (bed.type === "Ventilator") key = "ventilator";
        if (bed.type === "Oxygen-supported") key = "oxygen";

        if (!key) continue;

        summary[key].total += count;
        if (bed.status === "Occupied") summary[key].occupied += count;
        if (bed.status === "Vacant") summary[key].vacant += count;
      }
    }

    return summary;
  }, [inventory?.wards]);

  const addActivity = useCallback((msg: string) => {
    setActivity((prev) => [
      {
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        msg,
      },
      ...prev.slice(0, 9),
    ]);
  }, []);

  const invalidateInventory = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["resources", user?.hospital] });
  }, [queryClient, user?.hospital]);

  const handleBedSlotOccupied = useCallback(
    (payload?: BedSlotPayload) => {
      if (!payload?.hospitalId || !user?.hospital || payload.hospitalId !== user.hospital) {
        return;
      }

      invalidateInventory();

      const ward = payload?.bedSlot?.wardName || "Ward";
      const slotLabel = payload?.bedSlot?.slotLabel || "Slot";
      const bedType = payload?.bedSlot?.bedType || "Bed";
      const lifecycleEvent = payload?.lifecycleEvent || "bed-slot-occupied";

      let msg = `${ward} ${slotLabel}: status changed (${bedType})`;
      if (lifecycleEvent === "bed-slot-occupied") {
        msg = `${ward} ${slotLabel}: patient assigned (${bedType})`;
      }
      if (lifecycleEvent === "bed-slot-reserved") {
        msg = `${ward} ${slotLabel}: bed reserved (${bedType})`;
      }
      if (lifecycleEvent === "bed-slot-released") {
        msg = `${ward} ${slotLabel}: bed released to vacant (${bedType})`;
      }

      addActivity(msg);

      if (lifecycleEvent === "bed-slot-occupied") {
        toast.success(`Patient assigned in ${ward}`);
      }
    },
    [addActivity, invalidateInventory, user?.hospital]
  );

  const handleTransferRequested = useCallback(
    (payload?: TransferEventPayload) => {
      if (!payload?.hospitalId || !user?.hospital || payload.hospitalId !== user.hospital) {
        return;
      }

      const transferId = payload?.transfer?._id || "Transfer";
      const patientName = payload?.transfer?.patientName || "Patient";
      addActivity(`${transferId}: transfer requested for ${patientName}`);
      invalidateInventory();
    },
    [addActivity, invalidateInventory, user?.hospital]
  );

  const handleTransferStatusUpdated = useCallback(
    (payload?: TransferEventPayload) => {
      if (!payload?.hospitalId || !user?.hospital || payload.hospitalId !== user.hospital) {
        return;
      }

      const transferId = payload?.transfer?._id || "Transfer";
      const status = payload?.transfer?.status || "updated";
      addActivity(`${transferId}: transfer status ${status}`);
      invalidateInventory();
    },
    [addActivity, invalidateInventory, user?.hospital]
  );

  useSocket<BedSlotPayload>({
    eventName: "bed-slot-reserved",
    onEvent: handleBedSlotOccupied,
  });

  useSocket<BedSlotPayload>({
    eventName: "bed-slot-occupied",
    onEvent: handleBedSlotOccupied,
  });

  useSocket<BedSlotPayload>({
    eventName: "bed-slot-released",
    onEvent: handleBedSlotOccupied,
  });

  useSocket<BedSlotPayload>({
    eventName: "bed-slot-status-changed",
    onEvent: handleBedSlotOccupied,
  });

  useSocket<TransferEventPayload>({
    eventName: "transfer-requested",
    onEvent: handleTransferRequested,
  });

  useSocket<TransferEventPayload>({
    eventName: "transfer-status-updated",
    onEvent: handleTransferStatusUpdated,
  });

  const quickSearchLabelMap = {
    icu: "ICU",
    general: "General",
    ventilator: "Ventilator",
    oxygen: "Oxygen",
  };

  const quickSearchAvailable = metrics[selectedBedCategory].vacant;

  if (isLoading) {
    return (
      <div>
        <TopBar title="My Hospital - Bed Overview" />
        <div className="p-6">
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title="My Hospital — Bed Overview" />
      <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-foreground font-medium">{hospitalName}</p>
          <p className="text-xs text-muted-foreground">Region: {regionLabel}</p>
        </div>
        <LiveIndicator />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="ICU" value={`${metrics.icu.vacant} Vacant`} subtitle={`of ${metrics.icu.total} total`} icon={<HeartPulse size={20} />} status={metrics.icu.vacant > 0 ? "vacant" : "critical"}>
          <OccupancyBar occupied={metrics.icu.occupied} total={metrics.icu.total} className="mt-3" />
        </MetricCard>
        <MetricCard title="General" value={`${metrics.general.vacant} Vacant`} subtitle={`of ${metrics.general.total} total`} icon={<Bed size={20} />} status={metrics.general.vacant > 0 ? "vacant" : "critical"}>
          <OccupancyBar occupied={metrics.general.occupied} total={metrics.general.total} className="mt-3" />
        </MetricCard>
        <MetricCard title="Ventilator" value={`${metrics.ventilator.vacant} Vacant`} subtitle={`of ${metrics.ventilator.total} total`} icon={<Wind size={20} />} status={metrics.ventilator.vacant > 0 ? "vacant" : "critical"}>
          <OccupancyBar occupied={metrics.ventilator.occupied} total={metrics.ventilator.total} className="mt-3" />
        </MetricCard>
        <MetricCard title="Oxygen" value={`${metrics.oxygen.vacant} Vacant`} subtitle={`of ${metrics.oxygen.total} total`} icon={<Droplets size={20} />} status={metrics.oxygen.vacant > 0 ? "warning" : "critical"}>
          <OccupancyBar occupied={metrics.oxygen.occupied} total={metrics.oxygen.total} className="mt-3" />
        </MetricCard>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Quick Search</h3>
        <div className="flex items-center gap-4">
          <select
            value={selectedBedCategory}
            onChange={(event) => setSelectedBedCategory(event.target.value as "icu" | "general" | "ventilator" | "oxygen")}
            className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground"
          >
            <option value="icu">ICU</option>
            <option value="general">General</option>
            <option value="ventilator">Ventilator</option>
            <option value="oxygen">Oxygen</option>
          </select>
          <span className="text-sm text-status-vacant">{quickSearchLabelMap[selectedBedCategory]}: {quickSearchAvailable} beds available</span>
          <Button size="sm" onClick={() => navigate("/doctor/request-transfer")}>Request Transfer</Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Recent Bed Activity</h3>
        {activity.map((a, i) => (
          <div key={i} className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{a.time}</span>
            <span>-</span>
            <span>{a.msg}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Last sync: {inventory?.updatedAt ? new Date(inventory.updatedAt).toLocaleTimeString() : "just now"}
      </p>
    </div>
    </div>
  );
};

export default DoctorOverview;
