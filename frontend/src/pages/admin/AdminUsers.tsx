import TopBar from "@/components/TopBar";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
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

const AdminUsers = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users-list"],
    queryFn: async () => {
      // Backend controller listAllUsers for HOSPITAL_ADMIN already filters for DOCTOR role & their specific hospital
      const res = await apiRequest<{ users: UserModel[] }>("/users", { auth: true });
      return res.data.users;
    }
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/users/${id}/approve`, { method: "POST", auth: true });
    },
    onSuccess: () => {
      toast.success("Doctor approved successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to approve doctor");
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await apiRequest(`/users/${id}/status`, { method: "PUT", auth: true, body: { isActive } });
    },
    onSuccess: (_, variables) => {
      toast.success(`Doctor ${variables.isActive ? 'activated' : 'suspended'} successfully`);
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to change doctor status");
    }
  });

  const filteredUsers = users.filter((u) => {
    // Search filter
    const matchesSearch = 
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Status filter
    let statusText = "Pending";
    if (u.isApproved) {
        statusText = u.isActive ? "Active" : "Deactivated";
    }
    const matchesStatus = statusFilter === "All Status" || statusFilter === statusText;

    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <TopBar title="User Management" />
      <div className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex gap-4 items-center flex-wrap">
                <select 
                    value={statusFilter} 
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                >
                    <option>All Status</option>
                    <option>Active</option>
                    <option>Pending</option>
                    <option>Deactivated</option>
                </select>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <input 
                        placeholder="Search doctors..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="rounded-md border border-border bg-secondary pl-10 pr-3 py-2 text-sm text-foreground w-64 outline-none focus:ring-1 focus:ring-primary" 
                    />
                </div>
            </div>
            <p className="text-sm text-muted-foreground font-medium">Managing Doctors for {currentUser?.hospital ? 'your hospital' : 'HOLOID'}</p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-5 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Doctor Name</th>
                <th className="px-5 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Email</th>
                <th className="px-5 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-5 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Signed Up</th>
                <th className="px-5 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-3">
                       <Loader2 className="animate-spin text-primary" size={24} /> 
                       <span>Fetching doctors list...</span>
                    </div>
                  </td>
                </tr>
              )}
              {!isLoading && filteredUsers.map((u) => {
                 let statusLabel = "Pending";
                 let statusType = "warning"; 
                 
                 if (u.isApproved) {
                    statusLabel = u.isActive ? "Active" : "Deactivated";
                    statusType = u.isActive ? "vacant" : "critical"; 
                 }

                 return (
                  <tr key={u._id} className="hover:bg-accent/5 transition-colors">
                    <td className="px-5 py-4 font-semibold text-foreground">{u.name}</td>
                    <td className="px-5 py-4 text-muted-foreground font-medium">{u.email}</td>
                    <td className="px-5 py-4">
                      <StatusBadge status={statusType as "vacant"|"warning"|"critical"} label={statusLabel} />
                    </td>
                    <td className="px-5 py-4 text-muted-foreground text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        {!u.isApproved && (
                            <Button 
                            variant="default" 
                            size="sm" 
                            className="bg-primary hover:bg-primary/90"
                            onClick={() => approveMutation.mutate(u._id)}
                            disabled={approveMutation.isPending}
                            >
                            {approveMutation.isPending ? <Loader2 className="animate-spin w-4 h-4" /> : "Approve Account"}
                            </Button>
                        )}
                        
                        {u.isApproved && (
                            <Button 
                            variant={u.isActive ? "destructive" : "outline"} 
                            size="sm" 
                            className={u.isActive ? "" : "border-primary text-primary hover:bg-primary/5"}
                            onClick={() => toggleStatusMutation.mutate({ id: u._id, isActive: !u.isActive })}
                            disabled={toggleStatusMutation.isPending}
                            >
                            {toggleStatusMutation.isPending ? <Loader2 className="animate-spin w-4 h-4" /> : (u.isActive ? "Suspend Access" : "Re-activate")}
                            </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                 );
              })}
              {!isLoading && filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-muted-foreground italic">
                    No matching doctor records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-2">
             <p className="text-xs text-muted-foreground">Doctors are automatically filtered to your hospital only.</p>
             <p className="text-xs font-medium text-muted-foreground">{filteredUsers.length} doctor(s) found</p>
        </div>
      </div>
    </div>
  );
};

export default AdminUsers;
