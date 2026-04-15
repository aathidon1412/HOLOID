import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bed, Wind, HeartPulse, Droplets, Plus, Pencil, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import axiosInstance from "@/api/axiosInstance";

import TopBar from "@/components/TopBar";
import MetricCard from "@/components/MetricCard";
import OccupancyBar from "@/components/OccupancyBar";
import LiveIndicator from "@/components/LiveIndicator";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";

type BedType = "ICU" | "General" | "Ventilator" | "Oxygen-supported";
type BedStatus = "Occupied" | "Vacant" | "Maintenance";

interface BedData {
  type: BedType;
  status: BedStatus;
  count: number;
}

interface WardData {
  wardName: string;
  beds: BedData[];
}

interface ResourceInventory {
  _id: string;
  hospital: { _id: string; name: string } | string;
  region: string;
  wards: WardData[];
  updatedAt?: string;
}

const formatBedTypeLabel = (type: string): string => {
  if (type === "Oxygen-supported") return "Oxygen Beds";
  if (type === "Ventilator") return "Ventilators";
  return type;
};

const AdminInventory = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editModal, setEditModal] = useState<null | { ward: string; type: BedType; status: BedStatus; count: number }>(null);
  
  // State for Add Ward Modal
  const [addWardModal, setAddWardModal] = useState(false);
  const [newWardName, setNewWardName] = useState("");
  const [newWardBeds, setNewWardBeds] = useState<{type: BedType, count: number}[]>([]);
  const [selectedNewBedType, setSelectedNewBedType] = useState<BedType>("ICU");
  const [selectedNewBedCount, setSelectedNewBedCount] = useState<number>(0);
  const [wards, setWards] = useState<WardData[]>([]);
  const [isCreatingWard, setIsCreatingWard] = useState(false);

  const { data: inventory, isLoading } = useQuery({
    queryKey: ["resources", user?.hospital],
    queryFn: async () => {
      if (!user?.hospital) throw new Error("No hospital assigned");
      const res = await axiosInstance.get("/resources", {
        params: { hospitalId: user.hospital },
      });

      const resources: ResourceInventory[] =
        res?.data?.data ||
        res?.data?.resources ||
        [];

      return resources[0] || null;
    },
    enabled: !!user?.hospital,
  });

  useEffect(() => {
    setWards(inventory?.wards || []);
  }, [inventory]);

  const updateBedMutation = useMutation({
    mutationFn: async (payload: { wardName: string; bedType: string; status: string; count: number }) => {
      const res = await axiosInstance.put(`/resources/${user?.hospital}/beds`, payload);
      return res.data?.data || res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources", user?.hospital] });
      toast.success("Bed count updated successfully");
      setEditModal(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed to update bed count");
    }
  });

  const updateInventoryMutation = useMutation({
    mutationFn: async (wards: WardData[]) => {
      const res = await axiosInstance.put(`/resources/${user?.hospital}`, { wards });
      return res.data?.data || res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources", user?.hospital] });
      toast.success("Inventory updated");
      setAddWardModal(false);
      setNewWardName("");
      setNewWardBeds([]);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed to update inventory");
    }
  });

  const handleSaveModal = () => {
    if (!editModal) return;
    updateBedMutation.mutate({
      wardName: editModal.ward,
      bedType: editModal.type,
      status: editModal.status,
      count: Number(editModal.count)
    });
  };

  const handleCreateWard = async () => {
    if (!newWardName.trim()) {
      toast.error("Ward name is required");
      return;
    }

    if (!user?.hospital) {
      toast.error("No hospital assigned");
      return;
    }

    if (!newWardBeds.length) {
      toast.error("Add at least one bed type and capacity");
      return;
    }
    
    // Convert newWardBeds to the expected BedData schema
    // Initially, all added beds are "Vacant". The other statuses will be 0.
    const bedsArray: BedData[] = [];
    newWardBeds.forEach(b => {
      bedsArray.push({ type: b.type, status: "Vacant", count: b.count });
      bedsArray.push({ type: b.type, status: "Occupied", count: 0 });
      bedsArray.push({ type: b.type, status: "Maintenance", count: 0 });
    });

    const newWard: WardData = {
      wardName: newWardName,
      beds: bedsArray
    };

    if (wards.find(w => w.wardName === newWard.wardName)) {
      toast.error("A ward with this name already exists");
      return;
    }

    const nextWards = [...wards, newWard];

    try {
      setIsCreatingWard(true);

      try {
        await axiosInstance.post("/resources", {
          hospital: user.hospital,
          region: inventory?.region || "Default Region",
          wards: nextWards,
        });
      } catch (err: any) {
        const status = err?.response?.status;
        const isExistingInventoryConflict = status === 409 && !!inventory;

        if (!isExistingInventoryConflict) {
          throw err;
        }

        await axiosInstance.put(`/resources/${user.hospital}`, {
          wards: nextWards,
        });
      }

      setWards(nextWards);
      toast.success("Ward created successfully");
      setAddWardModal(false);
      setNewWardName("");
      setNewWardBeds([]);
      queryClient.invalidateQueries({ queryKey: ["resources", user?.hospital] });
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Failed to create ward";
      toast.error(message);
    } finally {
      setIsCreatingWard(false);
    }
  };

  const handleDeleteWard = (wardName: string) => {
    if (!confirm(`Are you sure you want to delete ${wardName}?`)) return;
    
    const filteredWards = wards.filter(w => w.wardName !== wardName);
    setWards(filteredWards);
    updateInventoryMutation.mutate(filteredWards);
  };

  const metrics = useMemo(() => {
    const summary = {
      icu: { occupied: 0, total: 0 },
      general: { occupied: 0, total: 0 },
      ventilator: { occupied: 0, total: 0 },
      oxygen: { occupied: 0, total: 0 },
    };

    if (!wards.length) return summary;

    wards.forEach(ward => {
      ward.beds.forEach(bed => {
        let category: keyof typeof summary | null = null;
        if (bed.type === "ICU") category = "icu";
        if (bed.type === "General") category = "general";
        if (bed.type === "Ventilator") category = "ventilator";
        if (bed.type === "Oxygen-supported") category = "oxygen";

        if (category) {
          summary[category].total += bed.count;
          if (bed.status === "Occupied") {
            summary[category].occupied += bed.count;
          }
        }
      });
    });
    return summary;
  }, [wards]);

  if (isLoading) {
    return (
      <div>
        <TopBar title="Resource Inventory" />
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="animate-spin text-muted-foreground mr-2" size={24} />
          <span>Loading inventory...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title="Resource Inventory" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <LiveIndicator />
          <span className="text-xs text-muted-foreground">
            Last sync: {inventory?.updatedAt ? new Date(inventory.updatedAt).toLocaleTimeString() : "just now"}
          </span>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard 
            title="ICU Beds" 
            value={`${metrics.icu.occupied} / ${metrics.icu.total}`} 
            subtitle={`${metrics.icu.total > 0 ? Math.round((metrics.icu.occupied / metrics.icu.total) * 100) : 0}% occupied`} 
            icon={<HeartPulse size={20} />} 
            status={metrics.icu.total > 0 && (metrics.icu.occupied / metrics.icu.total) > 0.7 ? "critical" : "vacant"}
          >
            <OccupancyBar occupied={metrics.icu.occupied} total={metrics.icu.total} className="mt-3" />
          </MetricCard>
          <MetricCard 
            title="General Beds" 
            value={`${metrics.general.occupied} / ${metrics.general.total}`} 
            subtitle={`${metrics.general.total > 0 ? Math.round((metrics.general.occupied / metrics.general.total) * 100) : 0}% occupied`} 
            icon={<Bed size={20} />} 
            status="warning"
          >
            <OccupancyBar occupied={metrics.general.occupied} total={metrics.general.total} className="mt-3" />
          </MetricCard>
          <MetricCard 
            title="Ventilators" 
            value={`${metrics.ventilator.occupied} / ${metrics.ventilator.total}`} 
            subtitle={`${metrics.ventilator.total > 0 ? Math.round((metrics.ventilator.occupied / Math.max(metrics.ventilator.total, 1)) * 100) : 0}% utilized`} 
            icon={<Wind size={20} />} 
            status="vacant"
          >
            <OccupancyBar occupied={metrics.ventilator.occupied} total={metrics.ventilator.total} className="mt-3" />
          </MetricCard>
          <MetricCard 
            title="Oxygen Beds" 
            value={`${metrics.oxygen.occupied} / ${metrics.oxygen.total}`} 
             subtitle={`${metrics.oxygen.total > 0 ? Math.round((metrics.oxygen.occupied / Math.max(metrics.oxygen.total, 1)) * 100) : 0}% utilized`} 
            icon={<Droplets size={20} />} 
            status="warning"
          >
            <OccupancyBar occupied={metrics.oxygen.occupied} total={metrics.oxygen.total} className="mt-3" />
          </MetricCard>
        </div>

        {/* Wards List Check */}
        {wards.length === 0 ? (
           <div className="flex flex-col items-center justify-center h-48 border border-dashed border-border rounded-lg bg-card/30">
            <p className="text-muted-foreground mb-4">No wards have been added to your hospital yet.</p>
           </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {wards.map((ward) => {
              // Calculate occupied/total per category for a ward
              const localStats = {
                "ICU": { occupied: 0, total: 0 },
                "General": { occupied: 0, total: 0 },
                "Ventilator": { occupied: 0, total: 0 },
                "Oxygen-supported": { occupied: 0, total: 0 }
              };

              ward.beds.forEach(b => {
                if (localStats[b.type as keyof typeof localStats]) {
                  localStats[b.type as keyof typeof localStats].total += b.count;
                  if (b.status === "Occupied") {
                    localStats[b.type as keyof typeof localStats].occupied += b.count;
                  }
                }
              });

              return (
                <div key={ward.wardName} className="rounded-lg border border-border bg-card p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-border/50 pb-2">
                    <h3 className="text-sm font-semibold text-foreground">{ward.wardName}</h3>
                    <button 
                      onClick={() => handleDeleteWard(ward.wardName)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      title="Delete Ward"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(localStats).map(([type, stats]) => {
                      const pct = stats.total > 0 ? (stats.occupied / stats.total) * 100 : 0;
                      const statusVal = pct >= 90 ? "critical" : pct >= 70 ? "warning" : "vacant";
                      
                      if (stats.total === 0) return null; // Don't show if they have no capacity configured for this type

                      return (
                        <div key={type} className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            <StatusBadge status={statusVal} label={formatBedTypeLabel(type)} />
                            <span className="text-sm font-medium text-foreground">{stats.occupied} / {stats.total}</span>
                          </div>
                          <button
                            onClick={() => {
                              const occBed = ward.beds.find(b => b.type === type && b.status === "Occupied");
                              setEditModal({ 
                                ward: ward.wardName, 
                                type: type as BedType, 
                                status: "Occupied", 
                                count: occBed?.count || 0 
                              });
                            }}
                            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                        </div>
                      );
                    })}
                    
                    {Object.values(localStats).every(s => s.total === 0) && (
                      <p className="text-xs text-muted-foreground text-center">No beds configured yet.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Button variant="outline" className="gap-2" onClick={() => setAddWardModal(true)}>
          <Plus size={16} /> Add New Ward
        </Button>

        {/* Add New Ward Modal */}
        {addWardModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-5">
              <h3 className="font-semibold text-foreground text-lg">Create New Ward</h3>
              
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Ward Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Ward A - Critical Care"
                    value={newWardName} 
                    onChange={(e) => setNewWardName(e.target.value)}
                    className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground" 
                  />
                </div>

                <div className="p-4 rounded-md border border-border bg-background space-y-3">
                   <p className="text-sm font-medium">Add Bed Types</p>
                   <div className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1">
                        <label className="text-xs text-muted-foreground">Bed Type</label>
                        <select 
                          value={selectedNewBedType} 
                          onChange={(e) => setSelectedNewBedType(e.target.value as BedType)}
                          className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground"
                        >
                          <option value="ICU">ICU</option>
                          <option value="General">General</option>
                          <option value="Ventilator">Ventilators</option>
                          <option value="Oxygen-supported">Oxygen Beds</option>
                        </select>
                      </div>
                      <div className="w-24 space-y-1">
                        <label className="text-xs text-muted-foreground">Capacity</label>
                        <input 
                          type="number" 
                          min={1}
                          value={selectedNewBedCount} 
                          onChange={(e) => setSelectedNewBedCount(parseInt(e.target.value) || 0)}
                          className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground" 
                        />
                      </div>
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => {
                          if (selectedNewBedCount <= 0) return;
                          // Check if type already exists in newWardBeds
                          if (newWardBeds.some(b => b.type === selectedNewBedType)) {
                            setNewWardBeds(newWardBeds.map(b => b.type === selectedNewBedType ? {...b, count: b.count + selectedNewBedCount} : b));
                          } else {
                            setNewWardBeds([...newWardBeds, { type: selectedNewBedType, count: selectedNewBedCount }]);
                          }
                          setSelectedNewBedCount(0); // reset after adding
                        }}
                      >
                        Add
                      </Button>
                   </div>

                   {/* List of configured bed types for the new ward */}
                   {newWardBeds.length > 0 && (
                     <div className="mt-3 space-y-2">
                       <p className="text-xs font-semibold text-muted-foreground">Configured Beds:</p>
                       {newWardBeds.map((bed, idx) => (
                         <div key={idx} className="flex justify-between items-center bg-secondary px-3 py-1.5 rounded text-sm">
                           <span>{formatBedTypeLabel(bed.type)}</span>
                           <div className="flex items-center gap-3">
                             <span className="font-semibold">{bed.count} Total</span>
                             <button 
                               onClick={() => setNewWardBeds(newWardBeds.filter((_, i) => i !== idx))}
                               className="text-muted-foreground hover:text-destructive"
                             >
                               <Trash2 size={14} />
                             </button>
                           </div>
                         </div>
                       ))}
                     </div>
                   )}
                </div>
              </div>

              <div className="flex gap-3 justify-end mt-4">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setAddWardModal(false);
                    setNewWardName("");
                    setNewWardBeds([]);
                  }}
                  disabled={isCreatingWard || updateInventoryMutation.isPending}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateWard} 
                  disabled={isCreatingWard || updateInventoryMutation.isPending}
                >
                  {(isCreatingWard || updateInventoryMutation.isPending) && <Loader2 className="animate-spin mr-2" size={16} />}
                  Create Ward
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Resource Modal */}
        {editModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 space-y-4">
              <h3 className="font-semibold text-foreground">Update Bed Status Breakdown</h3>
              <p className="text-sm text-muted-foreground">{editModal.ward} — {formatBedTypeLabel(editModal.type)}</p>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Status Setting</label>
                  <select 
                    value={editModal.status} 
                    onChange={(e) => {
                      const newStatus = e.target.value as BedStatus;
                      // Find existing count for this status to auto-fill
                      const existingBed = wards.find(w => w.wardName === editModal.ward)?.beds.find(b => b.type === editModal.type && b.status === newStatus);
                      setEditModal({...editModal, status: newStatus, count: existingBed ? existingBed.count : 0 });
                    }}
                    className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground"
                  >
                    <option value="Occupied">Occupied</option>
                    <option value="Vacant">Vacant</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Count to mark as {editModal.status}</label>
                  <input 
                    type="number" 
                    min={0}
                    value={editModal.count} 
                    onChange={(e) => setEditModal({...editModal, count: parseInt(e.target.value) || 0})}
                    className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground" 
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-4">
                <Button variant="outline" onClick={() => setEditModal(null)} disabled={updateBedMutation.isPending}>Cancel</Button>
                <Button onClick={handleSaveModal} disabled={updateBedMutation.isPending}>
                  {updateBedMutation.isPending && <Loader2 className="animate-spin mr-2" size={16} />}
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminInventory;
