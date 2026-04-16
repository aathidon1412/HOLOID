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

export type LiveFleetItem = {
  transferId: string;
  patientName: string;
  requiredBedType: string;
  transferStatus: string;
  dispatchStatus: string;
  driverWorkflowStatus: string;
  fromHospital: {
    id: string;
    name: string;
    region: string;
    coordinates: { lat: number; lng: number } | null;
  };
  toHospital: {
    id: string;
    name: string;
    region: string;
    coordinates: { lat: number; lng: number } | null;
  };
  ambulance: {
    id: string;
    vehicleNumber: string;
    label: string;
    status: string;
  };
  driver: {
    id: string;
    name: string;
  };
  marker: {
    lat: number;
    lng: number;
    source: string;
    updatedAt: string | null;
  } | null;
  cadenceSec: number | null;
  isMoving: boolean;
  speedKmph: number | null;
  etaToDestinationMin: number | null;
  distanceToDestinationKm: number | null;
  updatedAt: string;
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

  async getLiveFleet() {
    const res = await axiosInstance.get("/command-center/fleet/live");
    return {
      fleet: (res.data?.fleet || []) as LiveFleetItem[],
      metrics: {
        activeTransfers: Number(res.data?.metrics?.activeTransfers || 0),
        inTransit: Number(res.data?.metrics?.inTransit || 0),
        awaitingDriver: Number(res.data?.metrics?.awaitingDriver || 0),
        accepted: Number(res.data?.metrics?.accepted || 0),
      },
    };
  },
};
