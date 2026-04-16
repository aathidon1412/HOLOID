import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { useAuth } from "@/contexts/AuthContext";
import axiosInstance from "@/api/axiosInstance";

type BedKey = "icuBeds" | "generalBeds" | "ventilatorBeds";

type PendingTransfer = {
  id: string;
  patientName: string;
  fromDoctor: string;
  bedTypeLabel: string;
  bedTypeKey: BedKey;
  requestedAt: string;
  status: string;
  dispatchStatus: string;
};

type TransferHistoryItem = {
  id: string;
  patientName: string;
  fromDoctor: string;
  fromHospitalName: string;
  toHospitalName: string;
  bedTypeLabel: string;
  status: string;
  actedAt: string;
};

type WardAvailability = Record<BedKey, number>;

type TransferRequestedPayload = {
  emittedAt?: string;
  transfer?: {
    _id?: string;
    patientName?: string;
    requiredBedType?: string;
    requestedBy?: { name?: string };
  };
};

type BedSlotSocketPayload = {
  hospitalId?: string;
};

type TransferStatusPayload = {
  hospitalId?: string;
  transfer?: {
    _id?: string;
    status?: string;
  };
};

type ResourceInventory = {
  wards?: Array<{
    wardName?: string;
    beds?: Array<{
      type?: string;
      status?: string;
      count?: number;
    }>;
  }>;
};

type OpenTransferApiItem = {
  _id?: string;
  patientName?: string;
  requiredBedType?: string;
  status?: string;
  dispatchStatus?: string;
  requestedBy?: {
    name?: string;
  };
  createdAt?: string;
};

type TransferHistoryApiItem = {
  _id?: string;
  patientName?: string;
  requestedBy?: { name?: string };
  requiredBedType?: string;
  status?: string;
  updatedAt?: string;
  createdAt?: string;
  fromHospital?: { name?: string } | string;
  toHospital?: { name?: string } | string;
};

const bedTypeKey = (value?: string): BedKey => {
  if (value === "generalBeds") return "generalBeds";
  if (value === "ventilatorBeds") return "ventilatorBeds";
  return "icuBeds";
};

const bedTypeLabel = (value?: string): string => {
  if (value === "generalBeds") return "General";
  if (value === "ventilatorBeds") return "Ventilator";
  return "ICU";
};

const mapTransferToPending = (transfer: OpenTransferApiItem): PendingTransfer => ({
  id: transfer._id || `TR-LIVE-${Date.now()}`,
  patientName: transfer.patientName || "Unknown Patient",
  fromDoctor: transfer.requestedBy?.name || "Doctor",
  bedTypeLabel: bedTypeLabel(transfer.requiredBedType),
  bedTypeKey: bedTypeKey(transfer.requiredBedType),
  requestedAt: transfer.createdAt
    ? new Date(transfer.createdAt).toLocaleString()
    : new Date().toLocaleString(),
  status: String(transfer.status || "requested").toLowerCase(),
  dispatchStatus: String(transfer.dispatchStatus || "unassigned").toLowerCase(),
});

const isPendingRequest = (transfer: OpenTransferApiItem) => {
  const transferStatus = String(transfer.status || "").trim().toLowerCase();
  return transferStatus === "requested";
};

const mapTransferToHistory = (transfer: TransferHistoryApiItem): TransferHistoryItem => ({
  id: transfer._id || "N/A",
  patientName: transfer.patientName || "Unknown Patient",
  fromDoctor: transfer.requestedBy?.name || "Doctor",
  fromHospitalName:
    typeof transfer.fromHospital === "string"
      ? transfer.fromHospital
      : transfer.fromHospital?.name || "Unknown Hospital",
  toHospitalName:
    typeof transfer.toHospital === "string"
      ? transfer.toHospital
      : transfer.toHospital?.name || "Unknown Hospital",
  bedTypeLabel: bedTypeLabel(transfer.requiredBedType),
  status: String(transfer.status || "unknown").replace(/_/g, " "),
  actedAt: transfer.updatedAt
    ? new Date(transfer.updatedAt).toLocaleString()
    : transfer.createdAt
      ? new Date(transfer.createdAt).toLocaleString()
      : "-",
});

const statusPillClass = (status: string) => {
  const normalized = status.trim().toLowerCase();
  if (normalized.includes("completed")) return "bg-status-vacant/15 text-status-vacant";
  if (normalized.includes("cancel")) return "bg-status-critical/15 text-status-critical";
  if (normalized.includes("in transit") || normalized.includes("dispatched")) {
    return "bg-status-info/15 text-status-info";
  }
  return "bg-status-warning/15 text-status-warning";
};

const AdminTransfers = () => {
  const { user } = useAuth();
  const [pendingTransfers, setPendingTransfers] = useState<PendingTransfer[]>([]);
  const [transferHistory, setTransferHistory] = useState<TransferHistoryItem[]>([]);
  const [wardAvailability, setWardAvailability] = useState<WardAvailability>({
    icuBeds: 0,
    generalBeds: 0,
    ventilatorBeds: 0,
  });
  const [processingTransferId, setProcessingTransferId] = useState<string | null>(null);
  const [processingTransferAction, setProcessingTransferAction] = useState<"accept" | "reject" | null>(null);

  const loadCurrentHospitalBeds = useCallback(async () => {
    if (!user?.hospital) return;

    try {
      const res = await axiosInstance.get("/resources", {
        params: { hospitalId: user.hospital },
      });

      const resources: ResourceInventory[] =
        res?.data?.data ||
        res?.data?.resources ||
        [];

      const resource = resources[0];
      if (!resource?.wards?.length) {
        setWardAvailability({
          icuBeds: 0,
          generalBeds: 0,
          ventilatorBeds: 0,
        });
        return;
      }

      let icuBeds = 0;
      let generalBeds = 0;
      let ventilatorBeds = 0;

      for (const ward of resource.wards) {
        for (const bed of ward.beds || []) {
          if (bed.status !== "Vacant") continue;
          const count = Number(bed.count || 0);
          if (bed.type === "ICU") icuBeds += count;
          if (bed.type === "General") generalBeds += count;
          if (bed.type === "Ventilator") ventilatorBeds += count;
        }
      }

      setWardAvailability({
        icuBeds,
        generalBeds,
        ventilatorBeds,
      });
    } catch {
      toast.error("Could not load ward bed counts");
    }
  }, [user?.hospital]);

  const loadOpenTransfers = useCallback(async () => {
    if (!user?.hospital) return;

    try {
      const res = await axiosInstance.get(`/logistics/hospitals/${user.hospital}/transfers/open`);
      const transfers: OpenTransferApiItem[] = res?.data?.transfers || [];
      setPendingTransfers(transfers.filter(isPendingRequest).map(mapTransferToPending));
    } catch {
      toast.error("Could not load pending transfers");
    }
  }, [user?.hospital]);

  const loadTransferHistory = useCallback(async () => {
    if (!user?.hospital) return;

    try {
      const res = await axiosInstance.get("/logistics/history", {
        params: { hospitalId: user.hospital },
      });

      const transfers: TransferHistoryApiItem[] =
        res?.data?.transfers ||
        res?.data?.data?.transfers ||
        [];

      setTransferHistory(transfers.map(mapTransferToHistory));
    } catch {
      toast.error("Could not load transfer history");
    }
  }, [user?.hospital]);

  useEffect(() => {
    loadCurrentHospitalBeds();
    loadOpenTransfers();
    loadTransferHistory();
  }, [loadCurrentHospitalBeds, loadOpenTransfers, loadTransferHistory]);

  const onTransferRequested = useCallback((payload: TransferRequestedPayload) => {
    if (payload?.hospitalId && user?.hospital && payload.hospitalId !== user.hospital) {
      return;
    }

    void loadOpenTransfers();
    void loadTransferHistory();
    void loadCurrentHospitalBeds();
    if (payload?.transfer?.patientName) {
      toast.success(`Transfer request received for ${payload.transfer.patientName}`);
    }
  }, [loadCurrentHospitalBeds, loadOpenTransfers, loadTransferHistory, user?.hospital]);

  useSocket<TransferRequestedPayload>({
    eventName: "transfer-requested",
    onEvent: onTransferRequested,
  });

  const onTransferStatusUpdated = useCallback(
    (payload: TransferStatusPayload) => {
      if (payload?.hospitalId && user?.hospital && payload.hospitalId !== user.hospital) {
        return;
      }

      void loadOpenTransfers();
      void loadTransferHistory();
      void loadCurrentHospitalBeds();
    },
    [loadCurrentHospitalBeds, loadOpenTransfers, loadTransferHistory, user?.hospital]
  );

  useSocket<TransferStatusPayload>({
    eventName: "transfer-status-updated",
    onEvent: onTransferStatusUpdated,
  });

  const onBedSlotEvent = useCallback(
    (payload: BedSlotSocketPayload) => {
      if (payload?.hospitalId && user?.hospital && payload.hospitalId !== user.hospital) {
        return;
      }

      void loadCurrentHospitalBeds();
    },
    [loadCurrentHospitalBeds, user?.hospital]
  );

  useSocket<BedSlotSocketPayload>({
    eventName: "bed-slot-reserved",
    onEvent: onBedSlotEvent,
  });

  useSocket<BedSlotSocketPayload>({
    eventName: "bed-slot-occupied",
    onEvent: onBedSlotEvent,
  });

  useSocket<BedSlotSocketPayload>({
    eventName: "bed-slot-released",
    onEvent: onBedSlotEvent,
  });

  useSocket<BedSlotSocketPayload>({
    eventName: "bed-slot-status-changed",
    onEvent: onBedSlotEvent,
  });

  const handleResolveTransfer = async (request: PendingTransfer, action: "accept" | "reject") => {
    try {
      setProcessingTransferId(request.id);
      setProcessingTransferAction(action);

      if (action === "accept") {
        await axiosInstance.patch(`/logistics/transfer/${request.id}/accept`);
      } else {
        await axiosInstance.patch(`/logistics/transfer/${request.id}`, {
          status: "rejected",
          note: "Rejected by destination hospital admin",
          actor: {
            role: user?.role || "HOSPITAL_ADMIN",
            id: user?.id || "",
            name: user?.name || "",
          },
        });
      }

      setPendingTransfers((prev) => prev.filter((item) => item.id !== request.id));

      void loadOpenTransfers();
      void loadTransferHistory();
      void loadCurrentHospitalBeds();
      toast.success(action === "accept" ? "Transfer accepted" : "Transfer rejected");
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || `Failed to ${action} transfer`;
      toast.error(message);
    } finally {
      setProcessingTransferId(null);
      setProcessingTransferAction(null);
    }
  };

  return (
    <div>
      <TopBar title="Transfers & Ambulance" />
      <div className="p-6 space-y-6">
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Current Ward Availability</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">ICU Beds</p>
              <p className="text-lg font-semibold text-foreground">{wardAvailability.icuBeds}</p>
            </div>
            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">General Beds</p>
              <p className="text-lg font-semibold text-foreground">{wardAvailability.generalBeds}</p>
            </div>
            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Ventilator Beds</p>
              <p className="text-lg font-semibold text-foreground">{wardAvailability.ventilatorBeds}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Pending Requests</h3>
          <div className="space-y-3">
            {pendingTransfers.length === 0 ? (
              <p className="text-xs text-muted-foreground">No pending transfer requests right now.</p>
            ) : (
              pendingTransfers.map((request) => (
                <div key={request.id} className="rounded-md border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">{request.patientName}</p>
                      <p className="text-xs text-muted-foreground">From Doctor: {request.fromDoctor}</p>
                      <p className="text-xs text-muted-foreground">Bed Type: {request.bedTypeLabel}</p>
                      <p className="text-xs text-muted-foreground">Requested: {request.requestedAt}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleResolveTransfer(request, "accept")}
                      disabled={processingTransferId === request.id}
                    >
                      {processingTransferId === request.id && processingTransferAction === "accept" ? "Accepting..." : "Accept"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleResolveTransfer(request, "reject")}
                      disabled={processingTransferId === request.id}
                    >
                      {processingTransferId === request.id && processingTransferAction === "reject" ? "Rejecting..." : "Reject"}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Transfer History</h3>
            <Button variant="outline" size="sm" className="gap-2">
              <Search size={14} /> Filter
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-border">
                  <th className="py-2 pr-3 text-muted-foreground font-medium">Transfer ID</th>
                  <th className="py-2 pr-3 text-muted-foreground font-medium">Patient</th>
                  <th className="py-2 pr-3 text-muted-foreground font-medium">From Doctor</th>
                  <th className="py-2 pr-3 text-muted-foreground font-medium">From Hospital</th>
                  <th className="py-2 pr-3 text-muted-foreground font-medium">To Hospital</th>
                  <th className="py-2 pr-3 text-muted-foreground font-medium">Bed Type</th>
                  <th className="py-2 pr-3 text-muted-foreground font-medium">Status</th>
                  <th className="py-2 text-muted-foreground font-medium">Updated At</th>
                </tr>
              </thead>
              <tbody>
                {transferHistory.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-4 text-xs text-muted-foreground">
                      No transfer history yet.
                    </td>
                  </tr>
                ) : (
                  transferHistory.map((item) => (
                    <tr key={item.id} className="border-b border-border/60">
                      <td className="py-3 pr-3 text-foreground">{item.id}</td>
                      <td className="py-3 pr-3 text-foreground">{item.patientName}</td>
                      <td className="py-3 pr-3 text-foreground">{item.fromDoctor}</td>
                      <td className="py-3 pr-3 text-foreground">{item.fromHospitalName}</td>
                      <td className="py-3 pr-3 text-foreground">{item.toHospitalName}</td>
                      <td className="py-3 pr-3 text-foreground">{item.bedTypeLabel}</td>
                      <td className="py-3 pr-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusPillClass(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 text-muted-foreground">{item.actedAt}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminTransfers;
