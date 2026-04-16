import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import TopBar from "@/components/TopBar";
import LiveIndicator from "@/components/LiveIndicator";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/hooks/useSocket";
import { bedManagerService, BedSlotItem, TransferItem } from "@/services/bedManagerService";

const BED_TYPE_OPTIONS = [
  { label: "ICU", value: "icuBeds" },
  { label: "General", value: "generalBeds" },
  { label: "Ventilator", value: "ventilatorBeds" },
];

const mapSlotTypeToNormalized = (slotType: string) => {
  if (slotType === "ICU") return "icuBeds";
  if (slotType === "General") return "generalBeds";
  if (slotType === "Ventilator") return "ventilatorBeds";
  return "generalBeds";
};

const BedManagerEntry = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [patientName, setPatientName] = useState("");
  const [patientId, setPatientId] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [patientSex, setPatientSex] = useState("unknown");
  const [requiredBedType, setRequiredBedType] = useState("icuBeds");
  const [selectedSlotId, setSelectedSlotId] = useState("");

  const actor = useMemo(
    () => ({ role: user?.role || "BED_MANAGER", id: user?.id || "", name: user?.name || "" }),
    [user?.id, user?.name, user?.role]
  );

  const handleRealtimeOccupancyEvent = useCallback(
    (payload?: { hospitalId?: string }) => {
      if (payload?.hospitalId && user?.hospital && payload.hospitalId !== user.hospital) {
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["bed-manager-open-transfers", user?.hospital] });
      queryClient.invalidateQueries({ queryKey: ["bed-manager-vacant-slots", user?.hospital] });
      queryClient.invalidateQueries({ queryKey: ["bed-manager-occupied-slots", user?.hospital] });
    },
    [queryClient, user?.hospital]
  );

  useSocket<{ hospitalId?: string }>({
    eventName: "bed-slot-reserved",
    onEvent: handleRealtimeOccupancyEvent,
  });

  useSocket<{ hospitalId?: string }>({
    eventName: "bed-slot-occupied",
    onEvent: handleRealtimeOccupancyEvent,
  });

  useSocket<{ hospitalId?: string }>({
    eventName: "bed-slot-released",
    onEvent: handleRealtimeOccupancyEvent,
  });

  useSocket<{ hospitalId?: string }>({
    eventName: "bed-slot-status-changed",
    onEvent: handleRealtimeOccupancyEvent,
  });

  const { data: openTransfers = [], isLoading: loadingTransfers } = useQuery<TransferItem[]>({
    queryKey: ["bed-manager-open-transfers", user?.hospital],
    queryFn: () => bedManagerService.listOpenTransfers(user!.hospital!),
    enabled: !!user?.hospital,
  });

  const { data: vacantSlots = [], isLoading: loadingVacantSlots } = useQuery<BedSlotItem[]>({
    queryKey: ["bed-manager-vacant-slots", user?.hospital],
    queryFn: () => bedManagerService.listBedSlots(user!.hospital!, { status: "Vacant" }),
    enabled: !!user?.hospital,
  });

  const { data: occupiedSlots = [], isLoading: loadingOccupiedSlots } = useQuery<BedSlotItem[]>({
    queryKey: ["bed-manager-occupied-slots", user?.hospital],
    queryFn: () => bedManagerService.listBedSlots(user!.hospital!, { status: "Occupied" }),
    enabled: !!user?.hospital,
  });

  const assignMutation = useMutation({
    mutationFn: (slotId: string) =>
      bedManagerService.assignPatientToSlot(user!.hospital!, slotId, {
        patientName: patientName.trim(),
        patientId: patientId.trim() || undefined,
        patientAge: patientAge ? Number(patientAge) : null,
        patientSex,
        requiredBedType,
        actor,
      }),
    onSuccess: () => {
      toast.success("Patient assigned to bed successfully");
      setPatientName("");
      setPatientId("");
      setPatientAge("");
      setPatientSex("unknown");
      setSelectedSlotId("");
      queryClient.invalidateQueries({ queryKey: ["bed-manager-vacant-slots", user?.hospital] });
      queryClient.invalidateQueries({ queryKey: ["bed-manager-occupied-slots", user?.hospital] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed to assign patient");
    },
  });

  const releaseMutation = useMutation({
    mutationFn: (slotId: string) =>
      bedManagerService.releaseSlot(user!.hospital!, slotId, {
        note: "Released from Bed Manager console",
        actor,
      }),
    onSuccess: () => {
      toast.success("Bed released and patient discharged");
      queryClient.invalidateQueries({ queryKey: ["bed-manager-vacant-slots", user?.hospital] });
      queryClient.invalidateQueries({ queryKey: ["bed-manager-occupied-slots", user?.hospital] });
      queryClient.invalidateQueries({ queryKey: ["bed-manager-open-transfers", user?.hospital] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed to release bed");
    },
  });

  const transferStatusMutation = useMutation({
    mutationFn: ({ transferId, status, note }: { transferId: string; status: string; note: string }) =>
      bedManagerService.updateTransferStatus(transferId, { status, note, actor }),
    onSuccess: () => {
      toast.success("Transfer status updated");
      queryClient.invalidateQueries({ queryKey: ["bed-manager-open-transfers", user?.hospital] });
      queryClient.invalidateQueries({ queryKey: ["bed-manager-vacant-slots", user?.hospital] });
      queryClient.invalidateQueries({ queryKey: ["bed-manager-occupied-slots", user?.hospital] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed to update transfer");
    },
  });

  const filteredVacantSlots = useMemo(
    () => vacantSlots.filter((slot) => mapSlotTypeToNormalized(slot.bedType) === requiredBedType),
    [vacantSlots, requiredBedType]
  );

  return (
    <div>
      <TopBar title="Bed Manager Console" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <LiveIndicator />
          <span className="text-xs text-muted-foreground">Patient assignment and discharge workflow</span>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Assign Patient to Exact Bed Slot</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <input
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="Patient name"
              className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground"
            />
            <input
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              placeholder="Patient ID (optional)"
              className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground"
            />
            <input
              type="number"
              min={0}
              value={patientAge}
              onChange={(e) => setPatientAge(e.target.value)}
              placeholder="Age"
              className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground"
            />
            <select
              value={patientSex}
              onChange={(e) => setPatientSex(e.target.value)}
              className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground"
            >
              <option value="unknown">Sex: Unknown</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
            <select
              value={requiredBedType}
              onChange={(e) => setRequiredBedType(e.target.value)}
              className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground"
            >
              {BED_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  Bed Type: {option.label}
                </option>
              ))}
            </select>
            <select
              value={selectedSlotId}
              onChange={(e) => setSelectedSlotId(e.target.value)}
              className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground"
            >
              <option value="">Select vacant slot</option>
              {filteredVacantSlots.map((slot) => (
                <option key={slot._id} value={slot._id}>
                  {slot.wardName} / {slot.slotLabel} / {slot.bedType}
                </option>
              ))}
            </select>
          </div>

          <Button
            onClick={() => {
              if (!patientName.trim()) {
                toast.error("Patient name is required");
                return;
              }
              if (!selectedSlotId) {
                toast.error("Please select a vacant slot");
                return;
              }
              assignMutation.mutate(selectedSlotId);
            }}
            disabled={assignMutation.isPending || !user?.hospital || loadingVacantSlots}
          >
            {assignMutation.isPending ? "Assigning..." : "Assign Patient"}
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Incoming Transfers with Reserved Beds</h3>
          {loadingTransfers ? (
            <p className="text-sm text-muted-foreground">Loading transfers...</p>
          ) : openTransfers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open transfers for this hospital.</p>
          ) : (
            <div className="space-y-2">
              {openTransfers.map((transfer) => (
                <div key={transfer._id} className="rounded-md border border-border bg-background p-3">
                  <p className="text-sm font-medium text-foreground">{transfer.patientName} ({transfer.requiredBedType})</p>
                  <p className="text-xs text-muted-foreground">
                    From: {transfer.fromHospital?.name || "Unknown"} | Reserved Slot: {transfer.reservedBedSlot?.slotLabel || "Pending"}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        transferStatusMutation.mutate({
                          transferId: transfer._id,
                          status: "completed",
                          note: "Patient arrived and admitted by bed manager",
                        })
                      }
                      disabled={transferStatusMutation.isPending}
                    >
                      Mark Arrived
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        transferStatusMutation.mutate({
                          transferId: transfer._id,
                          status: "cancelled",
                          note: "Transfer cancelled by bed manager",
                        })
                      }
                      disabled={transferStatusMutation.isPending}
                    >
                      Cancel and Release
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Occupied Beds (Release/Discharge)</h3>
          {loadingOccupiedSlots ? (
            <p className="text-sm text-muted-foreground">Loading occupied slots...</p>
          ) : occupiedSlots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No occupied slots currently.</p>
          ) : (
            <div className="space-y-2">
              {occupiedSlots.map((slot) => (
                <div key={slot._id} className="rounded-md border border-border bg-background p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{slot.wardName} / {slot.slotLabel}</p>
                    <p className="text-xs text-muted-foreground">
                      {slot.bedType} | Patient: {slot.reservedForPatient?.name || slot.reservedForPatient?.patientId || "Unknown"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => releaseMutation.mutate(slot._id)}
                    disabled={releaseMutation.isPending}
                  >
                    Release Bed
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BedManagerEntry;
