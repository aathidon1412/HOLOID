import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import TopBar from "@/components/TopBar";
import LiveIndicator from "@/components/LiveIndicator";
import { Button } from "@/components/ui/button";
import { useSocket } from "@/hooks/useSocket";
import { ambulanceDispatchService, DispatchTransfer, DriverProgressStatus } from "@/services/ambulanceDispatchService";

const PROGRESS_SEQUENCE: Array<{ label: string; status: DriverProgressStatus }> = [
  { label: "Mark En Route", status: "EN_ROUTE" },
  { label: "Mark Arrived", status: "ARRIVED" },
  { label: "Mark In Transit", status: "IN_TRANSIT" },
  { label: "Mark Handover Complete", status: "HANDOVER_COMPLETE" },
];

const getNextProgressStep = (workflow: DispatchTransfer["driverWorkflowStatus"]) => {
  if (workflow === "idle") return PROGRESS_SEQUENCE[0];
  if (workflow === "en_route") return PROGRESS_SEQUENCE[1];
  if (workflow === "arrived") return PROGRESS_SEQUENCE[2];
  if (workflow === "in_transit") return PROGRESS_SEQUENCE[3];
  return null;
};

const formatBedLabel = (value?: string) => {
  if (!value) return "Unknown";
  if (value === "icuBeds") return "ICU";
  if (value === "generalBeds") return "General";
  if (value === "ventilatorBeds") return "Ventilator";
  return value;
};

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
};

const AmbulanceDispatch = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"inbox" | "history">("inbox");
  const [locationCadenceSec, setLocationCadenceSec] = useState<number>(30);
  const hasShownLocationErrorRef = useRef(false);

  const refreshDispatchData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["driver-dispatch-inbox"] });
    queryClient.invalidateQueries({ queryKey: ["driver-dispatch-history"] });
  }, [queryClient]);

  useSocket({ eventName: "dispatch-assigned", onEvent: refreshDispatchData });
  useSocket({ eventName: "dispatch-responded", onEvent: refreshDispatchData });
  useSocket({ eventName: "dispatch-progress-updated", onEvent: refreshDispatchData });
  useSocket({ eventName: "dispatch-location-updated", onEvent: refreshDispatchData });

  const { data: inbox = [], isLoading: loadingInbox } = useQuery<DispatchTransfer[]>({
    queryKey: ["driver-dispatch-inbox"],
    queryFn: ambulanceDispatchService.listInboxDispatches,
  });

  const { data: history = [], isLoading: loadingHistory } = useQuery<DispatchTransfer[]>({
    queryKey: ["driver-dispatch-history"],
    queryFn: ambulanceDispatchService.listDispatchHistory,
  });

  const respondMutation = useMutation({
    mutationFn: ({ transferId, action, reason }: { transferId: string; action: "accept" | "reject"; reason?: string }) =>
      ambulanceDispatchService.respondToDispatch(transferId, {
        action,
        reason,
        note: action === "accept" ? "Driver accepted dispatch" : "Driver rejected dispatch",
      }),
    onSuccess: (_transfer, variables) => {
      toast.success(variables.action === "accept" ? "Dispatch accepted" : "Dispatch rejected");
      refreshDispatchData();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed to respond to dispatch");
    },
  });

  const progressMutation = useMutation({
    mutationFn: ({ transferId, status }: { transferId: string; status: DriverProgressStatus }) =>
      ambulanceDispatchService.updateProgress(transferId, {
        status,
        note: `Driver status updated: ${status}`,
      }),
    onSuccess: () => {
      toast.success("Dispatch progress updated");
      refreshDispatchData();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed to update progress");
    },
  });

  const locationMutation = useMutation({
    mutationFn: ({ transferId, lat, lng, isMoving, speedKmph }: {
      transferId: string;
      lat: number;
      lng: number;
      isMoving: boolean;
      speedKmph?: number | null;
    }) => ambulanceDispatchService.updateLocation(transferId, { lat, lng, isMoving, speedKmph }),
    onSuccess: (result) => {
      setLocationCadenceSec(result.cadenceSec || 30);
      hasShownLocationErrorRef.current = false;
    },
  });

  const inboxCards = useMemo(() => {
    return inbox.map((transfer) => {
      const nextStep = getNextProgressStep(transfer.driverWorkflowStatus);
      return { transfer, nextStep };
    });
  }, [inbox]);

  const activeLiveTransfer = useMemo(() => {
    return inbox.find(
      (transfer) =>
        transfer.dispatchStatus === "accepted" &&
        transfer.driverWorkflowStatus !== "handover_complete" &&
        ["requested", "dispatched", "in_transit"].includes(transfer.status)
    );
  }, [inbox]);

  useEffect(() => {
    let cancelled = false;

    const setupPush = async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return;
      }

      const keyResponse = await ambulanceDispatchService.getPushPublicKey();
      if (!keyResponse.enabled || !keyResponse.publicKey) {
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");

      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }

      if (permission !== "granted") {
        return;
      }

      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyResponse.publicKey),
        });
      }

      if (cancelled || !subscription) {
        return;
      }

      await ambulanceDispatchService.subscribePushAlerts(subscription.toJSON());
    };

    setupPush().catch(() => {
      // Push support is best-effort and should not block dispatch workflow.
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeLiveTransfer?._id) {
      setLocationCadenceSec(30);
      return;
    }

    if (!("geolocation" in navigator)) {
      return;
    }

    let disposed = false;
    let intervalId: number | null = null;

    const workflowStatus = activeLiveTransfer.driverWorkflowStatus;
    const isMovingByStatus = workflowStatus === "en_route" || workflowStatus === "in_transit";
    const cadence = isMovingByStatus ? 5 : 30;
    setLocationCadenceSec(cadence);

    const streamLocation = () => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          if (disposed) return;

          const speedMetersPerSecond = Number(position.coords.speed ?? 0);
          const speedKmph = Number.isFinite(speedMetersPerSecond)
            ? Number((Math.max(0, speedMetersPerSecond) * 3.6).toFixed(2))
            : null;

          try {
            await locationMutation.mutateAsync({
              transferId: activeLiveTransfer._id,
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              isMoving: isMovingByStatus,
              speedKmph,
            });
          } catch {
            if (!hasShownLocationErrorRef.current) {
              hasShownLocationErrorRef.current = true;
              toast.error("Live location update failed. Retrying in background.");
            }
          }
        },
        () => {
          // Silent geolocation failures avoid noisy repeated toasts on permission denial.
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: cadence * 1000,
        }
      );
    };

    streamLocation();
    intervalId = window.setInterval(streamLocation, cadence * 1000);

    return () => {
      disposed = true;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [activeLiveTransfer?._id, activeLiveTransfer?.driverWorkflowStatus, locationMutation]);

  return (
    <div>
      <TopBar title="Ambulance Dispatch" />
      <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <LiveIndicator />
          <span className="text-xs text-muted-foreground">
            Live cadence: {locationCadenceSec}s {activeLiveTransfer ? "(tracking active dispatch)" : "(idle)"}
          </span>
        </div>

        <div className="rounded-lg border border-border bg-card p-2 flex gap-2">
          <Button
            variant={activeTab === "inbox" ? "default" : "outline"}
            onClick={() => setActiveTab("inbox")}
            className="flex-1"
          >
            Dispatch Inbox
          </Button>
          <Button
            variant={activeTab === "history" ? "default" : "outline"}
            onClick={() => setActiveTab("history")}
            className="flex-1"
          >
            Dispatch History
          </Button>
        </div>

        {activeTab === "inbox" ? (
          <div className="space-y-3">
            {loadingInbox ? (
              <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Loading inbox...</div>
            ) : inboxCards.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                No active dispatches assigned.
              </div>
            ) : (
              inboxCards.map(({ transfer, nextStep }) => (
                <div key={transfer._id} className="rounded-lg border border-border bg-card p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{transfer.patientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {transfer.fromHospital?.name || "Unknown Source"} → {transfer.toHospital?.name || "Unknown Destination"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>Bed Type: <span className="text-foreground">{formatBedLabel(transfer.requiredBedType)}</span></div>
                    <div>Status: <span className="text-foreground">{transfer.status}</span></div>
                    <div>Dispatch: <span className="text-foreground">{transfer.dispatchStatus}</span></div>
                    <div>Workflow: <span className="text-foreground">{transfer.driverWorkflowStatus}</span></div>
                    <div>ETA: <span className="text-foreground">{transfer.route?.durationMin ?? "-"} min</span></div>
                    <div>Distance: <span className="text-foreground">{transfer.route?.distanceKm ?? "-"} km</span></div>
                  </div>

                  {transfer.dispatchStatus === "pending_driver" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => respondMutation.mutate({ transferId: transfer._id, action: "accept" })}
                        disabled={respondMutation.isPending}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          respondMutation.mutate({
                            transferId: transfer._id,
                            action: "reject",
                            reason: "Driver unavailable",
                          })
                        }
                        disabled={respondMutation.isPending}
                      >
                        Reject
                      </Button>
                    </div>
                  )}

                  {transfer.dispatchStatus === "accepted" && nextStep && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => progressMutation.mutate({ transferId: transfer._id, status: nextStep.status })}
                      disabled={progressMutation.isPending}
                    >
                      {nextStep.label}
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {loadingHistory ? (
              <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Loading history...</div>
            ) : history.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                No past dispatches yet.
              </div>
            ) : (
              history.map((transfer) => (
                <div key={transfer._id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                  <p className="text-sm font-semibold text-foreground">{transfer.patientName}</p>
                  <p className="text-xs text-muted-foreground">
                    {transfer.fromHospital?.name || "Unknown Source"} → {transfer.toHospital?.name || "Unknown Destination"}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>Transfer: <span className="text-foreground">{transfer.status}</span></div>
                    <div>Dispatch: <span className="text-foreground">{transfer.dispatchStatus}</span></div>
                    <div>Workflow: <span className="text-foreground">{transfer.driverWorkflowStatus}</span></div>
                    <div>Updated: <span className="text-foreground">{transfer.updatedAt ? new Date(transfer.updatedAt).toLocaleString() : "-"}</span></div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AmbulanceDispatch;
