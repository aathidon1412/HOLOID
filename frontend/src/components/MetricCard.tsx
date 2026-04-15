import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  status?: "vacant" | "warning" | "critical" | "info";
  children?: ReactNode;
}

const statusBorder: Record<string, string> = {
  vacant: "border-l-status-vacant",
  warning: "border-l-status-warning",
  critical: "border-l-status-critical",
  info: "border-l-status-info",
};

const MetricCard = ({ title, value, subtitle, icon, status, children }: MetricCardProps) => (
  <div className={cn(
    "rounded-lg border border-border bg-card p-5 border-l-4",
    status ? statusBorder[status] : "border-l-primary"
  )}>
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {icon && <div className="text-muted-foreground">{icon}</div>}
    </div>
    {children}
  </div>
);

export default MetricCard;
