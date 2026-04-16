import TopBar from "@/components/TopBar";
import LiveIndicator from "@/components/LiveIndicator";

const DataEntryBoard = () => {
  return (
    <div>
      <TopBar title="Data Entry Console" />
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <LiveIndicator />
          <span className="text-xs text-muted-foreground">Live updates channel</span>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground">Rapid Bed Status Updates</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            This console is ready for rapid on-ground updates. Upcoming work will add one-tap status
            changes and row-level validation for ICU, general, ventilator, and oxygen-supported beds.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DataEntryBoard;
