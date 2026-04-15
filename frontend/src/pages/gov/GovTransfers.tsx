import TopBar from "@/components/TopBar";
import StatusBadge from "@/components/StatusBadge";

const transfers = [
  { id: "TR-2048", patient: "Ravi Kumar", bed: "ICU", from: "City General", to: "Mercy General", status: "In Transit", statusType: "info" as const, time: "10:12 AM" },
  { id: "TR-2041", patient: "Priya Nair", bed: "General", from: "City General", to: "Riverside Care", status: "Dispatched", statusType: "warning" as const, time: "09:50 AM" },
  { id: "TR-2035", patient: "Mohan S.", bed: "Ventilator", from: "North City", to: "Greenfield", status: "Completed", statusType: "vacant" as const, time: "08:30 AM" },
  { id: "TR-2032", patient: "Anita Devi", bed: "General", from: "St. Adrian", to: "St. Helena", status: "Completed", statusType: "vacant" as const, time: "Yesterday" },
];

const GovTransfers = () => (
  <div>
    <TopBar title="Network-wide Transfer History" />
    <div className="p-6 space-y-6">
      <div className="flex gap-4 items-center flex-wrap">
        <input placeholder="Search transfers..." className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground w-64" />
        <select className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground">
          <option>All Statuses</option><option>In Transit</option><option>Dispatched</option><option>Completed</option>
        </select>
        <select className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground">
          <option>All Regions</option><option>South Zone</option><option>North Zone</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Patient</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Bed</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">From</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">To</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {transfers.map((t) => (
              <tr key={t.id} className="hover:bg-accent/50 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{t.id}</td>
                <td className="px-4 py-3 text-foreground">{t.patient}</td>
                <td className="px-4 py-3 text-muted-foreground">{t.bed}</td>
                <td className="px-4 py-3 text-muted-foreground">{t.from}</td>
                <td className="px-4 py-3 text-muted-foreground">{t.to}</td>
                <td className="px-4 py-3"><StatusBadge status={t.statusType} label={t.status} /></td>
                <td className="px-4 py-3 text-muted-foreground">{t.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

export default GovTransfers;
