import axiosInstance from "@/api/axiosInstance";

export type SlotStatus = "Occupied" | "Vacant" | "Maintenance" | "Reserved" | "Unavailable";

export interface BedSlotItem {
  _id: string;
  wardName: string;
  bedType: "ICU" | "General" | "Ventilator" | "Oxygen-supported";
  slotLabel: string;
  status: SlotStatus;
  reservedAt?: string;
  occupiedAt?: string;
  releasedAt?: string;
  reservedForPatient?: {
    _id: string;
    patientId?: string;
    name?: string;
    age?: number;
    sex?: string;
    status?: string;
  } | null;
}

export interface TransferItem {
  _id: string;
  status: string;
  patientName: string;
  requiredBedType: string;
  fromHospital?: { name?: string; region?: string };
  reservedBedSlot?: {
    wardName?: string;
    bedType?: string;
    slotLabel?: string;
    status?: string;
  } | null;
  route?: {
    durationMin?: number;
    distanceKm?: number;
    source?: string;
  };
}

export const bedManagerService = {
  async listOpenTransfers(hospitalId: string) {
    const res = await axiosInstance.get(`/logistics/hospitals/${hospitalId}/transfers/open`);
    return res.data?.transfers || [];
  },

  async listBedSlots(hospitalId: string, params?: { status?: string; bedType?: string; wardName?: string }) {
    const res = await axiosInstance.get(`/logistics/hospitals/${hospitalId}/bed-slots`, { params });
    return res.data?.bedSlots || [];
  },

  async assignPatientToSlot(
    hospitalId: string,
    slotId: string,
    payload: {
      patientName: string;
      patientId?: string;
      patientAge?: number | null;
      patientSex?: string;
      requiredBedType?: string;
      actor?: { role?: string; id?: string; name?: string };
    }
  ) {
    const res = await axiosInstance.post(`/logistics/hospitals/${hospitalId}/bed-slots/${slotId}/assign`, payload);
    return res.data;
  },

  async releaseSlot(
    hospitalId: string,
    slotId: string,
    payload?: { note?: string; actor?: { role?: string; id?: string; name?: string } }
  ) {
    const res = await axiosInstance.patch(`/logistics/hospitals/${hospitalId}/bed-slots/${slotId}/release`, payload || {});
    return res.data;
  },

  async updateSlotStatus(
    hospitalId: string,
    slotId: string,
    payload: { status: SlotStatus; note?: string; actor?: { role?: string; id?: string; name?: string } }
  ) {
    const res = await axiosInstance.patch(`/logistics/hospitals/${hospitalId}/bed-slots/${slotId}/status`, payload);
    return res.data;
  },

  async updateTransferStatus(
    transferId: string,
    payload: { status: string; note?: string; actor?: { role?: string; id?: string; name?: string } }
  ) {
    const res = await axiosInstance.patch(`/logistics/transfers/${transferId}/status`, payload);
    return res.data;
  }
};
