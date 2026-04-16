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
};
