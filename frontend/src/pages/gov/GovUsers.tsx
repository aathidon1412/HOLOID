import TopBar from "@/components/TopBar";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";

const users = [
  { name: "Dr. A. Rajesh", email: "araje@cityhosp.org", role: "Hospital Admin", status: "Active", statusType: "vacant" as const },
  { name: "Dr. S. Sharma", email: "sshar@cityhosp.org", role: "Doctor", status: "Active", statusType: "vacant" as const },
  { name: "R. Menon", email: "rmenon@gov.health", role: "Government Official", status: "Active", statusType: "vacant" as const },
  { name: "J. Patel", email: "jpate@mercygen.com", role: "Hospital Admin", status: "Active", statusType: "vacant" as const },
  { name: "T. Krishnan", email: "tkris@northmed.com", role: "Doctor", status: "Pending", statusType: "warning" as const },
];

const GovUsers = () => (
  <div>
    <TopBar title="User Management" />
    <div className="p-6 space-y-6">
      <div className="flex gap-4 items-center flex-wrap">
        <select className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground">
          <option>All Roles</option><option>Hospital Admin</option><option>Doctor</option><option>Government Official</option>
        </select>
        <select className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground">
          <option>All Status</option><option>Active</option><option>Pending</option>
        </select>
        <input placeholder="Search users..." className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground w-64" />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {users.map((u) => (
              <tr key={u.email} className="hover:bg-accent/50 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{u.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.role}</td>
                <td className="px-4 py-3"><StatusBadge status={u.statusType} label={u.status} /></td>
                <td className="px-4 py-3">
                  <Button variant="outline" size="sm">
                    {u.status === "Pending" ? "Resend" : "Disable"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Showing 5 of 134 users — Page 1 of 27</p>
    </div>
  </div>
);

export default GovUsers;
