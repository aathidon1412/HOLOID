import TopBar from "@/components/TopBar";
import LiveIndicator from "@/components/LiveIndicator";

const AmbulanceDispatch = () => {
  return (
    <div>
      <TopBar title="Ambulance Dispatch" />
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <LiveIndicator />
          <span className="text-xs text-muted-foreground">Driver operations</span>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground">Dispatch Inbox</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            The driver portal entry point is now available. Next implementation steps will add dispatch
            alerts, accept or reject actions, and live transit status updates.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AmbulanceDispatch;
