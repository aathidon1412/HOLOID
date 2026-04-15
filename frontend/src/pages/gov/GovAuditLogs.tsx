import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/button";

const logs = [
  { time: "13 Apr 2026, 09:21 UTC", entity: "Transfer", action: "Transfer escalated to regional command", actor: "Gov. Official — R. Menon" },
  { time: "13 Apr 2026, 09:07 UTC", entity: "Hospital", action: "ICU capacity threshold exceeded (95%)", actor: "System Monitor" },
  { time: "13 Apr 2026, 08:52 UTC", entity: "Resource", action: "Ventilator inventory adjusted — Ward C", actor: "Admin — J. Patel" },
  { time: "13 Apr 2026, 08:31 UTC", entity: "User", action: "Role permission updated — logistics op.", actor: "Security Controller" },
  { time: "13 Apr 2026, 08:16 UTC", entity: "Transfer", action: "Ambulance dispatch marked in transit", actor: "Dispatch Desk — A. Singh" },
];

const GovAuditLogs = () => (
  <div>
    <TopBar title="System Audit Logs" />
    <div className="p-6 space-y-6">
      <div className="flex gap-4 items-center flex-wrap">
        <select className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground">
          <option>All Entities</option><option>Transfer</option><option>Hospital</option><option>Resource</option><option>User</option>
        </select>
        <select className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground">
          <option>All Actions</option>
        </select>
        <select className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground">
          <option>100</option><option>500</option><option>1000</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Timestamp</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Entity</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Action</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Actor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {logs.map((l, i) => (
              <tr key={i} className="hover:bg-accent/50 transition-colors">
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{l.time}</td>
                <td className="px-4 py-3"><span className="rounded bg-accent px-2 py-0.5 text-xs text-foreground">{l.entity}</span></td>
                <td className="px-4 py-3 text-foreground">{l.action}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.actor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Showing 5 of 2,841 logs</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">← Prev</Button>
          <span className="px-3 py-1 text-xs text-muted-foreground">Page 1 of 569</span>
          <Button variant="outline" size="sm">Next →</Button>
        </div>
      </div>

      <Button variant="outline">Export Audit Log</Button>
    </div>
  </div>
);

export default GovAuditLogs;
