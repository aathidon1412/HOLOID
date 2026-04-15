import TopBar from "@/components/TopBar";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";

interface UserModel {
  _id: string;
  name: string;
  email: string;
  role: string;
  isApproved: boolean;
  isActive: boolean;
  hospital?: { _id: string; name: string };
  lastLoginAt?: string;
  createdAt: string;
}

const GovUsers = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [statusFilter, setStatusFilter] = useState("All Status");

  const isGov = currentUser?.role === "GOVERNMENT_OFFICIAL";
  const isAdmin = currentUser?.role === "HOSPITAL_ADMIN";

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const res = await apiRequest<{ users: UserModel[] }>("/users", { auth: true });
      return res.data.users;
    }
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/users/${id}/approve`, { method: "POST", auth: true });
    },
    onSuccess: () => {
      toast.success("User approved successfully");
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to approve user");
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await apiRequest(`/users/${id}/status`, { method: "PUT", auth: true, body: { isActive } });
    },
    onSuccess: (_, variables) => {
      toast.success(`User ${variables.isActive ? 'activated' : 'suspended'} successfully`);
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to change user status");
    }
  });

  const filteredUsers = users.filter((u) => {
    // Search filter
    const matchesSearch = 
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Role filter
    const displayRole = u.role.replace("_", " ");
    const matchesRole = roleFilter === "All Roles" || roleFilter.toUpperCase() === displayRole.toUpperCase();

    // Status filter
    let statusText = u.isApproved ? (u.isActive ? "Active" : "Deactivated") : "Pending";
    const matchesStatus = statusFilter === "All Status" || statusFilter === statusText;

    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div>
      <TopBar title="User Management" />
      <div className="p-6 space-y-6">
        <div className="flex gap-4 items-center flex-wrap">
          {isGov && (
            <select 
              value={roleFilter} 
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground"
            >
              <option>All Roles</option>
              <option>HOSPITAL ADMIN</option>
              <option>DOCTOR</option>
            </select>
          )}
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground"
          >
            <option>All Status</option>
            <option>Active</option>
            <option>Pending</option>
            <option>Deactivated</option>
          </select>
          <input 
            placeholder="Search users by name or email..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground w-64" 
          />
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Hospital</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    <div className="flex justify-center items-center gap-2">
                       <Loader2 className="animate-spin" size={16} /> Loading users...
                    </div>
                  </td>
                </tr>
              )}
              {!isLoading && filteredUsers.map((u) => {
                 let statusLabel = "Pending";
                 let statusType = "warning"; // warning maps to yellow/pending
                 
                 if (u.isApproved) {
                    statusLabel = u.isActive ? "Active" : "Deactivated";
                    statusType = u.isActive ? "vacant" : "critical"; // vacant = green, critical = red
                 }

                 const canApprove = (!u.isApproved) && (
                    (isGov && u.role === "HOSPITAL_ADMIN") ||
                    (isAdmin && u.role === "DOCTOR")
                 );

                 const canToggleStatus = u.isApproved && (
                    (isGov) || (isAdmin && u.role === "DOCTOR")
                 );

                 return (
                  <tr key={u._id} className="hover:bg-accent/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{u.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.role.replace("_", " ")}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.hospital ? u.hospital.name : "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={statusType as "vacant"|"warning"|"critical"} label={statusLabel} />
                    </td>
                    <td className="px-4 py-3 flex gap-2">
                      {canApprove && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => approveMutation.mutate(u._id)}
                          disabled={approveMutation.isPending}
                        >
                          {approveMutation.isPending ? <Loader2 className="animate-spin w-4 h-4" /> : "Approve"}
                        </Button>
                      )}
                      
                      {canToggleStatus && (
                        <Button 
                          variant={u.isActive ? "destructive" : "default"} 
                          size="sm" 
                          onClick={() => toggleStatusMutation.mutate({ id: u._id, isActive: !u.isActive })}
                          disabled={toggleStatusMutation.isPending}
                        >
                          {toggleStatusMutation.isPending ? <Loader2 className="animate-spin w-4 h-4" /> : (u.isActive ? "Suspend" : "Activate")}
                        </Button>
                      )}
                    </td>
                  </tr>
                 );
              })}
              {!isLoading && filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">No users match your filters</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">Showing {filteredUsers.length} total user(s)</p>
      </div>
    </div>
  );
};

export default GovUsers;
