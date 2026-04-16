import { useCallback, useEffect, useMemo, useState } from "react";

import TopBar from "@/components/TopBar";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import axiosInstance from "@/api/axiosInstance";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/hooks/useSocket";

type TransferTimelineItem = {
  status?: string;
  note?: string;
  updatedAt?: string;
};

type TransferRecord = {
  _id?: string;
  patientName?: string;
  requiredBedType?: string;
  status?: string;
  route?: { durationMin?: number };
  requestedBy?: { id?: string; name?: string };
  toHospital?: { name?: string } | string;
  createdAt?: string;
  updatedAt?: string;
  timeline?: TransferTimelineItem[];
};

const ACTIVE_STATUSES = new Set(["requested", "dispatched", "in_transit"]);

const readableDateTime = (value?: string) => {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString();
};

const bedTypeLabel = (value?: string) => {
  if (value === "icuBeds") return "ICU";
  if (value === "generalBeds") return "General";
  if (value === "ventilatorBeds") return "Ventilator";
  return value || "Unknown";
};

const statusBadgeType = (value?: string): "vacant" | "warning" | "critical" | "info" => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "completed") return "vacant";
  if (normalized === "cancelled") return "critical";
  if (normalized === "in_transit") return "info";
  if (normalized === "dispatched") return "warning";
  return "warning";
};

const statusLabel = (value?: string) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "Unknown";
  return normalized
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const timelineDotClass = (status?: string) => {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "completed") return "bg-status-vacant";
  if (normalized === "in_transit") return "bg-status-info pulse-live";
  if (normalized === "cancelled") return "bg-status-critical";
  return "bg-status-warning";
};

const DoctorTransfers = () => {
  const { user } = useAuth();
  const [scope, setScope] = useState<"mine" | "hospital">("mine");
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(null);

  const loadTransfers = useCallback(async () => {
    if (!user?.hospital) return;

    try {
      setIsLoading(true);
      const res = await axiosInstance.get("/logistics/history", {
        params: { hospitalId: user.hospital },
      });

      const allTransfers: TransferRecord[] = res?.data?.transfers || res?.data?.data?.transfers || [];
      const activeTransfers = allTransfers
        .filter((transfer) => ACTIVE_STATUSES.has(String(transfer.status || "").toLowerCase()))
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());

      setTransfers(activeTransfers);

      if (!activeTransfers.length) {
        setSelectedTransferId(null);
      } else if (!selectedTransferId || !activeTransfers.some((transfer) => transfer._id === selectedTransferId)) {
        setSelectedTransferId(activeTransfers[0]._id || null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedTransferId, user?.hospital]);

  useEffect(() => {
    void loadTransfers();
  }, [loadTransfers]);

  const handleRealtimeTransferEvent = useCallback(
    (payload?: { hospitalId?: string }) => {
      if (payload?.hospitalId && user?.hospital && payload.hospitalId !== user.hospital) {
        return;
      }

      void loadTransfers();
    },
    [loadTransfers, user?.hospital]
  );

  useSocket<{ hospitalId?: string }>({
    eventName: "transfer-requested",
    onEvent: handleRealtimeTransferEvent,
  });

  useSocket<{ hospitalId?: string }>({
    eventName: "transfer-status-updated",
    onEvent: handleRealtimeTransferEvent,
  });

  useSocket<{ hospitalId?: string }>({
    eventName: "dispatch-progress-updated",
    onEvent: handleRealtimeTransferEvent,
  });

  useSocket<{ hospitalId?: string }>({
    eventName: "dispatch-responded",
    onEvent: handleRealtimeTransferEvent,
  });

  const visibleTransfers = useMemo(() => {
    if (scope === "hospital") return transfers;

    return transfers.filter((transfer) => {
      if (transfer.requestedBy?.id && user?.id) {
        return String(transfer.requestedBy.id) === String(user.id);
      }

      if (transfer.requestedBy?.name && user?.name) {
        return transfer.requestedBy.name.trim().toLowerCase() === user.name.trim().toLowerCase();
      }

      return false;
    });
  }, [scope, transfers, user?.id, user?.name]);

  const selectedTransfer = useMemo(
    () => visibleTransfers.find((transfer) => transfer._id === selectedTransferId) || visibleTransfers[0] || null,
    [selectedTransferId, visibleTransfers]
  );

  return (
    <div>
      <TopBar title="Active Transfers" />
      <div className="p-6 space-y-6">
        <div className="flex gap-2">
          <button
            onClick={() => setScope("mine")}
            className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${scope === "mine" ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"}`}
          >
            Mine Only
          </button>
          <button
            onClick={() => setScope("hospital")}
            className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${scope === "hospital" ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"}`}
          >
            All Hospital Transfers
          </button>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading active transfers...</p>
          ) : visibleTransfers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active transfers found.</p>
          ) : (
            visibleTransfers.map((transfer) => (
              <div key={transfer._id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-foreground">
                      {transfer._id} - {transfer.patientName || "Unknown Patient"} ({bedTypeLabel(transfer.requiredBedType)})
                    </span>
                    <StatusBadge
                      status={statusBadgeType(transfer.status)}
                      label={statusLabel(transfer.status)}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    ETA: {transfer.route?.durationMin ? `${transfer.route.durationMin} min` : "-"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  To: {typeof transfer.toHospital === "string" ? transfer.toHospital : transfer.toHospital?.name || "Unknown Hospital"} • Initiated by {transfer.requestedBy?.name || "Doctor"} • {readableDateTime(transfer.updatedAt || transfer.createdAt)}
                </p>
                <Button variant="outline" size="sm" onClick={() => setSelectedTransferId(transfer._id || null)}>
                  View Full Timeline
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Transfer Timeline - {selectedTransfer?._id || "N/A"}
          </h3>
          <div className="space-y-3">
            {!selectedTransfer?.timeline?.length ? (
              <p className="text-xs text-muted-foreground">No timeline events available.</p>
            ) : (
              selectedTransfer.timeline.map((item, index) => (
                <div key={`${item.status || "status"}-${index}`} className="flex items-start gap-3">
                  <div className={`mt-1 h-3 w-3 rounded-full ${timelineDotClass(item.status)}`} />
                  <div>
                    <p className="text-xs font-medium text-foreground">
                      {readableDateTime(item.updatedAt)} - {statusLabel(item.status)}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.note || "Status updated"}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorTransfers;
