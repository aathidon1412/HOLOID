import TopBar from "@/components/TopBar";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const hospitals = [
  { name: "Mercy General Hospital", region: "South Zone", icu: "11 / 30", status: "Active", statusType: "vacant" as const },
  { name: "North City Medical Inst.", region: "North Zone", icu: "2 / 30", status: "Critical", statusType: "critical" as const },
  { name: "Riverside Care Institute", region: "South Zone", icu: "5 / 20", status: "Active", statusType: "vacant" as const },
  { name: "Greenfield Community Hosp.", region: "East Zone", icu: "18 / 25", status: "Active", statusType: "vacant" as const },
  { name: "St. Adrian Trauma Center", region: "Central Zone", icu: "4 / 30", status: "Warning", statusType: "warning" as const },
];

const GovHospitals = () => (
  <div>
    <TopBar title="Hospital Registry" />
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <input placeholder="Search hospitals..." className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground w-64" />
        <Button className="gap-2"><Plus size={16} /> Add New Hospital</Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Hospital Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Region</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">ICU Beds</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {hospitals.map((h) => (
              <tr key={h.name} className="hover:bg-accent/50 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{h.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{h.region}</td>
                <td className="px-4 py-3 text-muted-foreground">{h.icu}</td>
                <td className="px-4 py-3"><StatusBadge status={h.statusType} label={h.status} /></td>
                <td className="px-4 py-3 flex gap-2">
                  <Button variant="outline" size="sm">View</Button>
                  <Button variant="outline" size="sm">Edit</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">42 hospitals total — Page 1 of 5</p>
    </div>
  </div>
);

export default GovHospitals;
