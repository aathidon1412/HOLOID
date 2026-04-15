import { useEffect, useState } from "react";

import axiosInstance from "@/api/axiosInstance";

type TransferHistoryRow = {
  id: string;
  patientId: string;
  from: string;
  to: string;
  status: string;
  time: string;
};

const readableDateTime = (dateValue?: string) => {
  if (!dateValue) return "-";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "-";

  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");

  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
};

const toReadableStatus = (status?: string) => {
  const normalized = String(status || "").trim().toLowerCase().replace(/\s+/g, "_");

  if (normalized === "accepted" || normalized === "dispatched") return "Accepted";
  if (normalized === "pending" || normalized === "requested") return "Pending";

  if (!normalized) return "Unknown";

  return normalized
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const statusTextClass = (status: string) => {
  const normalizedStatus = status.trim().toLowerCase();

  if (normalizedStatus === "accepted") return "text-[#39FF14]";
  if (normalizedStatus === "pending") return "text-amber-400";

  return "text-foreground";
};

const TransferHistory = () => {
  const [rows, setRows] = useState<TransferHistoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchTransferHistory = async () => {
      try {
        setIsLoading(true);

        const response = await axiosInstance.get("/logistics/history");
        const transfers = response?.data?.transfers || response?.data?.data?.transfers || [];

        const mappedRows: TransferHistoryRow[] = Array.isArray(transfers)
          ? transfers.map((transfer: any) => ({
              id: transfer?._id || "N/A",
              patientId: transfer?.patientId?.trim?.() || "-",
              from: `${transfer?.requestedBy?.name || "Doctor"} / ${
                typeof transfer?.fromHospital === "string"
                  ? transfer.fromHospital
                  : transfer?.fromHospital?.name || "Unknown Hospital"
              }`,
              to:
                typeof transfer?.toHospital === "string"
                  ? transfer.toHospital
                  : transfer?.toHospital?.name || "Unknown Hospital",
              status: toReadableStatus(transfer?.status),
              time: readableDateTime(transfer?.updatedAt || transfer?.createdAt),
            }))
          : [];

        setRows(mappedRows);
        setErrorMessage(null);
      } catch (error: any) {
        const message =
          error?.response?.data?.message || error?.message || "Failed to load transfer history";
        setErrorMessage(message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransferHistory();
  }, []);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading transfer history...</p>;
  }

  if (errorMessage) {
    return <p className="text-sm text-status-critical">{errorMessage}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Patient ID</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">From (Doctor/Hospital)</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">To (Hospital)</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-accent/50 transition-colors">
              <td className="px-4 py-3 font-medium text-foreground">{row.patientId}</td>
              <td className="px-4 py-3 text-muted-foreground">{row.from}</td>
              <td className="px-4 py-3 text-muted-foreground">{row.to}</td>
              <td className={`px-4 py-3 font-semibold ${statusTextClass(row.status)}`}>{row.status}</td>
              <td className="px-4 py-3 text-muted-foreground">{row.time}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {rows.length === 0 && (
        <div className="px-4 py-6 text-sm text-muted-foreground">No transfer history found.</div>
      )}
    </div>
  );
};

export default TransferHistory;