import TopBar from "@/components/TopBar";
import StatusBadge from "@/components/StatusBadge";

const logs = [
  { id: "TR-2048", patient: "Ravi Kumar", bed: "ICU", dest: "Mercy Gen.", status: "In Transit", statusType: "info" as const },
  { id: "TR-2032", patient: "Anita Devi", bed: "General", dest: "St. Helena", status: "Completed", statusType: "vacant" as const },
  { id: "TR-2019", patient: "Mohan S.", bed: "Ventilator", dest: "Riverside", status: "Completed", statusType: "vacant" as const },
  { id: "TR-2007", patient: "Kavitha R.", bed: "Oxygen", dest: "City North", status: "Cancelled", statusType: "critical" as const },
];

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

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Patient</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Bed Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Destination</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {logs.map((l) => (
              <tr key={l.id} className="hover:bg-accent/50 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{l.id}</td>
                <td className="px-4 py-3 text-foreground">{l.patient}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.bed}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.dest}</td>
                <td className="px-4 py-3"><StatusBadge status={l.statusType} label={l.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Showing 4 of 21 transfers</p>
    </div>
  </div>
);

export default DoctorHistory;
