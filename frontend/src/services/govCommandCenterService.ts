import axiosInstance from "@/api/axiosInstance";

export type RegionOccupancy = {
  region: string;
  hospitals: number;
  totalCapacity: {
    generalBeds: number;
    icuBeds: number;
    ventilatorBeds: number;
  };
  available: {
    generalBeds: number;
    icuBeds: number;
    ventilatorBeds: number;
  };
  occupancyRate: {
    generalBeds: number;
    icuBeds: number;
    ventilatorBeds: number;
  };
};

export type CriticalHospital = {
  _id: string;
  name: string;
  region?: string;
  resources?: {
    generalBeds?: number;
    icuBeds?: number;
    ventilatorBeds?: number;
  };
  criticalTypes: string[];
};

export type TransferMetrics = {
  activeTransfers: number;
  inTransit: number;
  awaitingDriver: number;
  accepted: number;
};

export type GovTransferHistoryItem = {
  _id: string;
  patientId?: string;
  patientName?: string;
  requiredBedType?: "generalBeds" | "icuBeds" | "ventilatorBeds" | string;
  status?: string;
  fromHospital?: { name?: string; region?: string } | string;
  toHospital?: { name?: string; region?: string } | string;
  createdAt?: string;
  updatedAt?: string;
};

export type GovAuditLogItem = {
  _id: string;
  entityType?: string;
  action?: string;
  actor?: {
    role?: string;
    id?: string;
    name?: string;
  };
  createdAt?: string;
};

export const govCommandCenterService = {
  async getRegionOccupancySummary() {
    const res = await axiosInstance.get("/command-center/regions/occupancy");
    return (res.data?.regions || []) as RegionOccupancy[];
  },

  async getCriticalHospitals(threshold = 5) {
    const res = await axiosInstance.get("/command-center/hospitals/critical", {
      params: { threshold },
    });
    return (res.data?.hospitals || []) as CriticalHospital[];
  },

  async getTransferMetrics() {
    const res = await axiosInstance.get("/command-center/transfers/metrics");
    return {
      activeTransfers: Number(res.data?.metrics?.activeTransfers || 0),
      inTransit: Number(res.data?.metrics?.inTransit || 0),
      awaitingDriver: Number(res.data?.metrics?.awaitingDriver || 0),
      accepted: Number(res.data?.metrics?.accepted || 0),
    } as TransferMetrics;
  },

  async getTransferHistory(params?: { status?: string; limit?: number }) {
    const res = await axiosInstance.get("/command-center/transfers/history", {
      params: {
        status: params?.status || undefined,
        limit: params?.limit || 200,
      },
    });

    return {
      count: Number(res.data?.count || 0),
      transfers: (res.data?.transfers || []) as GovTransferHistoryItem[],
    };
  },

  async getAuditLogs(params?: { entityType?: string; action?: string; limit?: number }) {
    const res = await axiosInstance.get("/command-center/audit-logs", {
      params: {
        entityType: params?.entityType || undefined,
        action: params?.action || undefined,
        limit: params?.limit || 100,
      },
    });

    return {
      count: Number(res.data?.count || 0),
      logs: (res.data?.logs || []) as GovAuditLogItem[],
    };
  },
};
