import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import TopBar from "@/components/TopBar";
import StatusBadge from "@/components/StatusBadge";
import { useSocket } from "@/hooks/useSocket";
import { govCommandCenterService, GovTransferHistoryItem } from "@/services/govCommandCenterService";

const statusBadgeType = (status?: string): "vacant" | "warning" | "critical" | "info" => {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "completed") return "vacant";
  if (normalized === "cancelled") return "critical";
  if (normalized === "in_transit") return "info";
  if (normalized === "dispatched") return "warning";
  return "warning";
};

const statusLabel = (status?: string) => {
  const normalized = String(status || "").trim().toLowerCase();
  if (!normalized) return "Unknown";
  return normalized
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const bedTypeLabel = (value?: string) => {
  if (value === "icuBeds") return "ICU";
  if (value === "generalBeds") return "General";
  if (value === "ventilatorBeds") return "Ventilator";
  return value || "Unknown";
};

const toHospitalName = (transfer: GovTransferHistoryItem) => {
  if (typeof transfer.toHospital === "string") return transfer.toHospital;
  return transfer.toHospital?.name || "Unknown Hospital";
};

const fromHospitalName = (transfer: GovTransferHistoryItem) => {
  if (typeof transfer.fromHospital === "string") return transfer.fromHospital;
  return transfer.fromHospital?.name || "Unknown Hospital";
};

const toHospitalRegion = (transfer: GovTransferHistoryItem) => {
  if (typeof transfer.toHospital === "string") return "";
  return transfer.toHospital?.region || "";
};

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString();
};

const GovTransfers = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");

  const refreshTransferHistory = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["gov-transfer-history"] });
  }, [queryClient]);

  useSocket({ eventName: "transfer-requested", onEvent: refreshTransferHistory });
  useSocket({ eventName: "transfer-status-updated", onEvent: refreshTransferHistory });
  useSocket({ eventName: "dispatch-assigned", onEvent: refreshTransferHistory });
  useSocket({ eventName: "dispatch-responded", onEvent: refreshTransferHistory });
  useSocket({ eventName: "dispatch-progress-updated", onEvent: refreshTransferHistory });

  const { data, isLoading } = useQuery({
    queryKey: ["gov-transfer-history", statusFilter],
    queryFn: () =>
      govCommandCenterService.getTransferHistory({
        status: statusFilter === "all" ? undefined : statusFilter,
        limit: 200,
      }),
    refetchInterval: 10000,
  });

  const transfers = data?.transfers || [];

  const regions = useMemo(() => {
    const unique = new Set<string>();
    for (const transfer of transfers) {
      const region = toHospitalRegion(transfer);
      if (region) unique.add(region);
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [transfers]);

  const filteredTransfers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return transfers.filter((transfer) => {
      const matchesRegion =
        regionFilter === "all" || toHospitalRegion(transfer).toLowerCase() === regionFilter.toLowerCase();

      if (!matchesRegion) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        transfer.patientId || "",
        transfer.patientName || "",
        fromHospitalName(transfer),
        toHospitalName(transfer),
        statusLabel(transfer.status),
        bedTypeLabel(transfer.requiredBedType),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [regionFilter, searchTerm, transfers]);

  return (
    <div>
      <TopBar title="Network-wide Transfer History" />
      <div className="p-6 space-y-6">
        <div className="flex gap-4 items-center flex-wrap">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search transfers..."
            className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground w-64"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground"
          >
            <option value="all">All Statuses</option>
            <option value="requested">Requested</option>
            <option value="dispatched">Dispatched</option>
            <option value="in_transit">In Transit</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground"
          >
            <option value="all">All Regions</option>
            {regions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Patient ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Bed</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">From</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">To</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-5 text-sm text-muted-foreground">
                    Loading transfer history...
                  </td>
                </tr>
              ) : filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-5 text-sm text-muted-foreground">
                    No transfers found.
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((transfer) => (
                  <tr key={transfer._id} className="hover:bg-accent/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{transfer.patientId || "N/A"}</td>
                    <td className="px-4 py-3 text-foreground">{transfer.patientName || "Unknown Patient"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{bedTypeLabel(transfer.requiredBedType)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fromHospitalName(transfer)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{toHospitalName(transfer)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={statusBadgeType(transfer.status)} label={statusLabel(transfer.status)} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDateTime(transfer.updatedAt || transfer.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default GovTransfers;
