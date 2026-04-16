import axiosInstance from "@/api/axiosInstance";

export type DispatchResponseAction = "accept" | "reject";
export type DriverProgressStatus = "EN_ROUTE" | "ARRIVED" | "IN_TRANSIT" | "HANDOVER_COMPLETE";

export interface DispatchTransfer {
  _id: string;
  patientName: string;
  patientId?: string;
  requiredBedType: string;
  status: string;
  dispatchStatus: "unassigned" | "pending_driver" | "accepted" | "rejected";
  driverWorkflowStatus: "idle" | "en_route" | "arrived" | "in_transit" | "handover_complete";
  route?: {
    distanceKm?: number;
    durationMin?: number;
    source?: string;
  };
  dispatchMeta?: {
    assignedAt?: string;
    respondedAt?: string;
    acceptedAt?: string;
    rejectedAt?: string;
    rejectionReason?: string;
    lastStatusAt?: string;
  };
  driverLive?: {
    currentLocation?: {
      lat?: number;
      lng?: number;
      updatedAt?: string;
      source?: string;
    };
    cadenceSec?: number;
    isMoving?: boolean;
    speedKmph?: number | null;
    etaToDestinationMin?: number | null;
    distanceToDestinationKm?: number | null;
  };
  fromHospital?: {
    _id?: string;
    name?: string;
    region?: string;
  };
  toHospital?: {
    _id?: string;
    name?: string;
    region?: string;
  };
  reservedBedSlot?: {
    wardName?: string;
    bedType?: string;
    slotLabel?: string;
    status?: string;
  };
  assignedAmbulance?: {
    _id?: string;
    vehicleNumber?: string;
    label?: string;
    status?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export const ambulanceDispatchService = {
  async listInboxDispatches() {
    const res = await axiosInstance.get("/logistics/drivers/me/dispatches", {
      params: { mode: "active" },
    });
    return (res.data?.transfers || []) as DispatchTransfer[];
  },

  async listDispatchHistory() {
    const res = await axiosInstance.get("/logistics/drivers/me/dispatches", {
      params: { mode: "history" },
    });
    return (res.data?.transfers || []) as DispatchTransfer[];
  },

  async respondToDispatch(transferId: string, payload: { action: DispatchResponseAction; reason?: string; note?: string }) {
    const res = await axiosInstance.patch(`/logistics/drivers/me/dispatches/${transferId}/respond`, payload);
    return res.data?.transfer as DispatchTransfer;
  },

  async updateProgress(transferId: string, payload: { status: DriverProgressStatus; note?: string }) {
    const res = await axiosInstance.patch(`/logistics/drivers/me/dispatches/${transferId}/progress`, payload);
    return res.data?.transfer as DispatchTransfer;
  },

  async updateLocation(
    transferId: string,
    payload: { lat: number; lng: number; isMoving?: boolean; speedKmph?: number | null }
  ) {
    const res = await axiosInstance.patch(`/logistics/drivers/me/dispatches/${transferId}/location`, payload);
    return {
      transfer: res.data?.transfer as DispatchTransfer,
      cadenceSec: Number(res.data?.cadenceSec || 30),
    };
  },

  async getPushPublicKey() {
    const res = await axiosInstance.get("/notifications/push/public-key");
    return {
      publicKey: String(res.data?.publicKey || ""),
      enabled: Boolean(res.data?.enabled),
    };
  },

  async subscribePushAlerts(subscription: PushSubscriptionJSON) {
    await axiosInstance.post("/notifications/push/subscribe", { subscription });
  },

  async unsubscribePushAlerts(endpoint: string) {
    await axiosInstance.delete("/notifications/push/subscribe", { data: { endpoint } });
  },
};
