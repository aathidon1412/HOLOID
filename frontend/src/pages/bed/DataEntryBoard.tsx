import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import TopBar from "@/components/TopBar";
import LiveIndicator from "@/components/LiveIndicator";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/hooks/useSocket";
import { bedManagerService, BedSlotItem, SlotStatus } from "@/services/bedManagerService";

const STATUS_OPTIONS: SlotStatus[] = ["Vacant", "Reserved", "Maintenance", "Unavailable"];

const DataEntryBoard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [bedTypeFilter, setBedTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [statusDrafts, setStatusDrafts] = useState<Record<string, SlotStatus>>({});

  const actor = useMemo(
    () => ({ role: user?.role || "DATA_ENTRY", id: user?.id || "", name: user?.name || "" }),
    [user?.id, user?.name, user?.role]
  );

  const handleRealtimeOccupancyEvent = useCallback(
    (payload?: { hospitalId?: string }) => {
      if (payload?.hospitalId && user?.hospital && payload.hospitalId !== user.hospital) {
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["data-entry-bed-slots", user?.hospital] });
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

  const { data: allSlots = [], isLoading } = useQuery<BedSlotItem[]>({
    queryKey: ["data-entry-bed-slots", user?.hospital],
    queryFn: () => bedManagerService.listBedSlots(user!.hospital!),
    enabled: !!user?.hospital,
  });

  const filteredSlots = useMemo(() => {
    return allSlots.filter((slot) => {
      const bedTypeOk = bedTypeFilter === "all" || slot.bedType === bedTypeFilter;
      const statusOk = statusFilter === "all" || slot.status === statusFilter;
      return bedTypeOk && statusOk;
    });
  }, [allSlots, bedTypeFilter, statusFilter]);

  const updateStatusMutation = useMutation({
    mutationFn: ({ slotId, status }: { slotId: string; status: SlotStatus }) =>
      bedManagerService.updateSlotStatus(user!.hospital!, slotId, {
        status,
        note: "Updated from Data Entry console",
        actor,
      }),
    onSuccess: () => {
      toast.success("Slot status updated");
      queryClient.invalidateQueries({ queryKey: ["data-entry-bed-slots", user?.hospital] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed to update slot status");
    },
  });

  const releaseMutation = useMutation({
    mutationFn: (slotId: string) =>
      bedManagerService.releaseSlot(user!.hospital!, slotId, {
        note: "Released from Data Entry console",
        actor,
      }),
    onSuccess: () => {
      toast.success("Slot released");
      queryClient.invalidateQueries({ queryKey: ["data-entry-bed-slots", user?.hospital] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed to release slot");
    },
  });

  return (
    <div>
      <TopBar title="Data Entry Console" />
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <LiveIndicator />
          <span className="text-xs text-muted-foreground">Rapid bed-state transitions</span>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 flex flex-col md:flex-row gap-3 md:items-center">
          <select
            value={bedTypeFilter}
            onChange={(e) => setBedTypeFilter(e.target.value)}
            className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground"
          >
            <option value="all">All bed types</option>
            <option value="ICU">ICU</option>
            <option value="General">General</option>
            <option value="Ventilator">Ventilator</option>
            <option value="Oxygen-supported">Oxygen-supported</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground"
          >
            <option value="all">All statuses</option>
            <option value="Vacant">Vacant</option>
            <option value="Reserved">Reserved</option>
            <option value="Occupied">Occupied</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Unavailable">Unavailable</option>
          </select>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Bed Slot Status Grid</h3>
          </div>

          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading bed slots...</div>
          ) : filteredSlots.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No bed slots found for selected filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left">Ward</th>
                    <th className="px-4 py-2 text-left">Slot</th>
                    <th className="px-4 py-2 text-left">Type</th>
                    <th className="px-4 py-2 text-left">Current</th>
                    <th className="px-4 py-2 text-left">Set To</th>
                    <th className="px-4 py-2 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSlots.map((slot) => {
                    const nextStatus = statusDrafts[slot._id] || slot.status;
                    const canDirectUpdate = slot.status !== "Occupied";

                    return (
                      <tr key={slot._id} className="border-b border-border/60">
                        <td className="px-4 py-2 text-foreground">{slot.wardName}</td>
                        <td className="px-4 py-2 text-foreground">{slot.slotLabel}</td>
                        <td className="px-4 py-2 text-muted-foreground">{slot.bedType}</td>
                        <td className="px-4 py-2 text-muted-foreground">{slot.status}</td>
                        <td className="px-4 py-2">
                          <select
                            value={nextStatus}
                            onChange={(e) =>
                              setStatusDrafts((prev) => ({
                                ...prev,
                                [slot._id]: e.target.value as SlotStatus,
                              }))
                            }
                            disabled={!canDirectUpdate}
                            className="rounded-md border border-border bg-secondary px-2 py-1 text-xs text-foreground disabled:opacity-60"
                          >
                            {STATUS_OPTIONS.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!canDirectUpdate || nextStatus === slot.status || updateStatusMutation.isPending}
                              onClick={() => updateStatusMutation.mutate({ slotId: slot._id, status: nextStatus })}
                            >
                              Apply
                            </Button>
                            <Button
                              size="sm"
                              disabled={!(["Occupied", "Reserved"].includes(slot.status)) || releaseMutation.isPending}
                              onClick={() => releaseMutation.mutate(slot._id)}
                            >
                              Release
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataEntryBoard;
