import { cn } from "@/lib/utils";

type Status = "vacant" | "warning" | "critical" | "info";

const statusStyles: Record<Status, string> = {
  vacant: "bg-status-vacant/15 text-status-vacant border-status-vacant/30",
  warning: "bg-status-warning/15 text-status-warning border-status-warning/30",
  critical: "bg-status-critical/15 text-status-critical border-status-critical/30",
  info: "bg-status-info/15 text-status-info border-status-info/30",
};

const StatusBadge = ({ status, label }: { status: Status; label: string }) => (
  <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", statusStyles[status])}>
    <span className={cn("h-1.5 w-1.5 rounded-full", {
      "bg-status-vacant": status === "vacant",
      "bg-status-warning": status === "warning",
      "bg-status-critical": status === "critical",
      "bg-status-info": status === "info",
    })} />
    {label}
  </span>
);

export default StatusBadge;
