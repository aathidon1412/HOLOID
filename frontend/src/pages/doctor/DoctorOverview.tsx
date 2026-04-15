import TopBar from "@/components/TopBar";
import MetricCard from "@/components/MetricCard";
import OccupancyBar from "@/components/OccupancyBar";
import LiveIndicator from "@/components/LiveIndicator";
import { Bed, Wind, HeartPulse, Droplets } from "lucide-react";
import { Button } from "@/components/ui/button";

const activity = [
  { time: "10:34 AM", msg: "Ward A ICU: 1 bed now Occupied (14 → 13)" },
  { time: "10:21 AM", msg: "Ward B General: 2 beds cleared (Vacant)" },
  { time: "09:55 AM", msg: "Ward C Ventilator: 1 to Maintenance" },
];

const DoctorOverview = () => (
  <div>
    <TopBar title="My Hospital — Bed Overview" />
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-foreground font-medium">City General Hospital</p>
          <p className="text-xs text-muted-foreground">Region: South Zone</p>
        </div>
        <LiveIndicator />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="ICU" value="14 Vacant" subtitle="of 30 total" icon={<HeartPulse size={20} />} status="vacant">
          <OccupancyBar occupied={16} total={30} className="mt-3" />
        </MetricCard>
        <MetricCard title="General" value="62 Vacant" subtitle="of 120 total" icon={<Bed size={20} />} status="vacant">
          <OccupancyBar occupied={58} total={120} className="mt-3" />
        </MetricCard>
        <MetricCard title="Ventilator" value="6 Vacant" subtitle="of 15 total" icon={<Wind size={20} />} status="vacant">
          <OccupancyBar occupied={9} total={15} className="mt-3" />
        </MetricCard>
        <MetricCard title="Oxygen" value="24 Vacant" subtitle="of 40 total" icon={<Droplets size={20} />} status="warning">
          <OccupancyBar occupied={16} total={40} className="mt-3" />
        </MetricCard>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Quick Search</h3>
        <div className="flex items-center gap-4">
          <select className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground">
            <option>ICU</option><option>General</option><option>Ventilator</option><option>Oxygen</option>
          </select>
          <span className="text-sm text-status-vacant">→ 14 beds available</span>
          <Button size="sm">Request Transfer</Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Recent Bed Activity</h3>
        {activity.map((a, i) => (
          <div key={i} className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{a.time}</span>
            <span>—</span>
            <span>{a.msg}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default DoctorOverview;
