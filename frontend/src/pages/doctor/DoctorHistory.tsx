import TopBar from "@/components/TopBar";
import TransferHistory from "@/components/TransferHistory";

const DoctorHistory = () => (
  <div>
    <TopBar title="My Transfer Log" />
    <div className="p-6 space-y-6">
      <div className="flex gap-4 items-center">
        <input placeholder="Search..." className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground w-64" />
        <select className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground">
          <option>This Week</option><option>This Month</option><option>All Time</option>
        </select>
      </div>

      <TransferHistory />
    </div>
  </div>
);

export default DoctorHistory;
