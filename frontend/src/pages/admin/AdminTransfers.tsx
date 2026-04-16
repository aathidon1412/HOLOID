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
};

type TransferHistoryItem = {
  id: string;
  patientName: string;
  fromDoctor: string;
  bedTypeLabel: string;
  status: "Accepted";
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

const AdminTransfers = () => {
  const { user } = useAuth();
  const [pendingTransfers, setPendingTransfers] = useState<PendingTransfer[]>([]);
  const [transferHistory, setTransferHistory] = useState<TransferHistoryItem[]>([]);
  const [wardAvailability, setWardAvailability] = useState<WardAvailability>({
    icuBeds: 0,
    generalBeds: 0,
    ventilatorBeds: 0,
  });
  const [acceptingTransferId, setAcceptingTransferId] = useState<string | null>(null);

  const loadCurrentHospitalBeds = useCallback(async () => {
    if (!user?.hospital) return;

    try {
      const res = await axiosInstance.get("/hospitals");
      const hospitals = res.data?.data?.hospitals || res.data?.hospitals || [];
      const mine = hospitals.find((hospital: any) => hospital?._id === user.hospital);

      if (mine?.resources) {
        setWardAvailability({
          icuBeds: Number(mine.resources.icuBeds || 0),
          generalBeds: Number(mine.resources.generalBeds || 0),
          ventilatorBeds: Number(mine.resources.ventilatorBeds || 0),
        });
      }
    } catch {
      toast.error("Could not load ward bed counts");
    }
  }, [user?.hospital]);

  useEffect(() => {
    loadCurrentHospitalBeds();
  }, [loadCurrentHospitalBeds]);

  const onTransferRequested = useCallback((payload: TransferRequestedPayload) => {
    const transfer = payload?.transfer;

    if (!transfer) return;

    const transferId = transfer._id || `TR-LIVE-${Date.now()}`;
    const nextTransfer: PendingTransfer = {
      id: transferId,
      patientName: transfer.patientName || "Unknown Patient",
      fromDoctor: transfer.requestedBy?.name || "Doctor",
      bedTypeLabel: bedTypeLabel(transfer.requiredBedType),
      bedTypeKey: bedTypeKey(transfer.requiredBedType),
      requestedAt: payload?.emittedAt
        ? new Date(payload.emittedAt).toLocaleString()
        : new Date().toLocaleString(),
    };

    setPendingTransfers((current) => {
      if (current.some((entry) => entry.id === nextTransfer.id)) return current;
      return [nextTransfer, ...current];
    });

    toast.success(`Transfer request received for ${nextTransfer.patientName}`);
  }, []);

  useSocket<TransferRequestedPayload>({
    eventName: "transfer-requested",
    onEvent: onTransferRequested,
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

  const handleAcceptTransfer = async (request: PendingTransfer) => {
    try {
      setAcceptingTransferId(request.id);

      await axiosInstance.patch(`/logistics/transfer/${request.id}/accept`);

      setWardAvailability((current) => ({
        ...current,
        [request.bedTypeKey]: Math.max(0, (current[request.bedTypeKey] || 0) - 1),
      }));

      setPendingTransfers((current) => current.filter((entry) => entry.id !== request.id));
      setTransferHistory((current) => [
        {
          id: request.id,
          patientName: request.patientName,
          fromDoctor: request.fromDoctor,
          bedTypeLabel: request.bedTypeLabel,
          status: "Accepted",
          actedAt: new Date().toLocaleString(),
        },
        ...current,
      ]);

      toast.success("Transfer accepted");
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Failed to accept transfer";
      toast.error(message);
    } finally {
      setAcceptingTransferId(null);
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
                      onClick={() => handleAcceptTransfer(request)}
                      disabled={acceptingTransferId === request.id}
                    >
                      {acceptingTransferId === request.id ? "Accepting..." : "Accept"}
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
                  <th className="py-2 pr-3 text-muted-foreground font-medium">Bed Type</th>
                  <th className="py-2 pr-3 text-muted-foreground font-medium">Status</th>
                  <th className="py-2 text-muted-foreground font-medium">Updated At</th>
                </tr>
              </thead>
              <tbody>
                {transferHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-xs text-muted-foreground">
                      No accepted transfers in history yet.
                    </td>
                  </tr>
                ) : (
                  transferHistory.map((item) => (
                    <tr key={item.id} className="border-b border-border/60">
                      <td className="py-3 pr-3 text-foreground">{item.id}</td>
                      <td className="py-3 pr-3 text-foreground">{item.patientName}</td>
                      <td className="py-3 pr-3 text-foreground">{item.fromDoctor}</td>
                      <td className="py-3 pr-3 text-foreground">{item.bedTypeLabel}</td>
                      <td className="py-3 pr-3">
                        <span className="rounded-full bg-status-vacant/15 px-2 py-1 text-xs font-medium text-status-vacant">
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
