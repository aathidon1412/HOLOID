import TopBar from "@/components/TopBar";
import MetricCard from "@/components/MetricCard";
import OccupancyBar from "@/components/OccupancyBar";
import LiveIndicator from "@/components/LiveIndicator";
import StatusBadge from "@/components/StatusBadge";
import { Bed, Wind, HeartPulse, Droplets, Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const wards = [
  { name: "Ward A — Critical Care", lastSync: "2 min ago", icu: 14, icuTotal: 30, general: 26, generalTotal: 60, vent: 7, ventTotal: 15, oxygen: 11, oxygenTotal: 20 },
  { name: "Ward B — Trauma", lastSync: "4 min ago", icu: 8, icuTotal: 20, general: 33, generalTotal: 50, vent: 5, ventTotal: 10, oxygen: 18, oxygenTotal: 25 },
  { name: "Ward C — General Medicine", lastSync: "1 min ago", icu: 4, icuTotal: 10, general: 45, generalTotal: 80, vent: 3, ventTotal: 8, oxygen: 12, oxygenTotal: 20 },
  { name: "Ward D — Pediatrics", lastSync: "3 min ago", icu: 2, icuTotal: 8, general: 18, generalTotal: 30, vent: 2, ventTotal: 5, oxygen: 8, oxygenTotal: 15 },
];

const AdminInventory = () => {
  const [editModal, setEditModal] = useState<null | { ward: string; type: string; count: number }>(null);

  return (
    <div>
      <TopBar title="Resource Inventory" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <LiveIndicator />
          <span className="text-xs text-muted-foreground">Last sync: just now</span>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="ICU Beds" value="28 / 68" subtitle="41% occupied" icon={<HeartPulse size={20} />} status={28/68 > 0.7 ? "critical" : "vacant"}>
            <OccupancyBar occupied={28} total={68} className="mt-3" />
          </MetricCard>
          <MetricCard title="General Beds" value="122 / 220" subtitle="55% occupied" icon={<Bed size={20} />} status="warning">
            <OccupancyBar occupied={122} total={220} className="mt-3" />
          </MetricCard>
          <MetricCard title="Ventilators" value="17 / 38" subtitle="45% utilized" icon={<Wind size={20} />} status="vacant">
            <OccupancyBar occupied={17} total={38} className="mt-3" />
          </MetricCard>
          <MetricCard title="Oxygen Beds" value="49 / 80" subtitle="61% utilized" icon={<Droplets size={20} />} status="warning">
            <OccupancyBar occupied={49} total={80} className="mt-3" />
          </MetricCard>
        </div>

        {/* Ward Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {wards.map((ward) => (
            <div key={ward.name} className="rounded-lg border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">{ward.name}</h3>
                <span className="text-xs text-muted-foreground">Last sync: {ward.lastSync}</span>
              </div>
              <div className="space-y-3">
                {[
                  { label: "ICU", occupied: ward.icu, total: ward.icuTotal },
                  { label: "General", occupied: ward.general, total: ward.generalTotal },
                  { label: "Ventilator", occupied: ward.vent, total: ward.ventTotal },
                  { label: "Oxygen", occupied: ward.oxygen, total: ward.oxygenTotal },
                ].map((item) => {
                  const pct = (item.occupied / item.total) * 100;
                  const status = pct >= 90 ? "critical" : pct >= 70 ? "warning" : "vacant";
                  return (
                    <div key={item.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <StatusBadge status={status} label={item.label} />
                        <span className="text-sm font-medium text-foreground">{item.occupied} / {item.total}</span>
                      </div>
                      <button
                        onClick={() => setEditModal({ ward: ward.name, type: item.label, count: item.occupied })}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <Button variant="outline" className="gap-2">
          <Plus size={16} /> Add New Ward
        </Button>

        {/* Edit Modal */}
        {editModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 space-y-4">
              <h3 className="font-semibold text-foreground">Update Bed Count</h3>
              <p className="text-sm text-muted-foreground">{editModal.ward} — {editModal.type}</p>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Status</label>
                  <select className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground">
                    <option>Occupied</option>
                    <option>Vacant</option>
                    <option>Maintenance</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Count</label>
                  <input type="number" defaultValue={editModal.count} className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground" />
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setEditModal(null)}>Cancel</Button>
                <Button onClick={() => setEditModal(null)}>Save Changes</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminInventory;
