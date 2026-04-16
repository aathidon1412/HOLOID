import TopBar from "@/components/TopBar";
import LiveIndicator from "@/components/LiveIndicator";

const BedManagerEntry = () => {
  return (
    <div>
      <TopBar title="Bed Manager Console" />
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <LiveIndicator />
          <span className="text-xs text-muted-foreground">Operational workflow</span>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground">Patient to Bed Assignment</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            This role-specific console is now active. Next implementation steps will add patient lookup,
            exact bed slot reservation, and discharge/release actions.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BedManagerEntry;
