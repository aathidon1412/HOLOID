import { cn } from "@/lib/utils";

const OccupancyBar = ({ occupied, total, className }: { occupied: number; total: number; className?: string }) => {
  const pct = total > 0 ? (occupied / total) * 100 : 0;
  const color = pct >= 90 ? "bg-status-critical" : pct >= 70 ? "bg-status-warning" : "bg-status-vacant";

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{occupied} / {total}</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div className={cn("h-2 rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

export default OccupancyBar;
