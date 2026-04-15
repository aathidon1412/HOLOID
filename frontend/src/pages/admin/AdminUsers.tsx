import TopBar from "@/components/TopBar";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

const AdminUsers = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ users: any[] }>("/users/pending", { auth: true });
      setUsers(res.data.users || []);
    } catch (err) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await apiRequest(`/users/${id}/approve`, { method: "POST", auth: true });
      setUsers((s) => s.filter((u) => u._id !== id));
    } catch (err: any) {
      // ignore
    }
  };

  return (
    <div>
      <TopBar title="Pending User Approvals" />
      <div className="p-6 space-y-6">
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Requested</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {users.map((u) => (
                <tr key={u._id} className="hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{u.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.role}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(u.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <Button onClick={() => handleApprove(u._id)} variant="outline" size="sm">Approve</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminUsers;
