import TopBar from "@/components/TopBar";
import MetricCard from "@/components/MetricCard";
import StatusBadge from "@/components/StatusBadge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";

const forecastData = [
  { day: "Today", icu: 60, general: 55, vent: 40 },
  { day: "Day 2", icu: 66, general: 58, vent: 42 },
  { day: "Day 4", icu: 74, general: 62, vent: 44 },
  { day: "Day 7", icu: 83, general: 68, vent: 47 },
  { day: "Day 14", icu: 90, general: 74, vent: 50 },
  { day: "Day 21", icu: 95, general: 79, vent: 53 },
  { day: "Day 30", icu: 98, general: 84, vent: 55 },
];

const shortages = [
  { hospital: "North City Medical Institute", bed: "ICU", predicted: "~4 days", risk: "HIGH", riskType: "critical" as const },
  { hospital: "Central Metro Hospital", bed: "ICU", predicted: "~6 days", risk: "HIGH", riskType: "critical" as const },
  { hospital: "St. Adrian Trauma Center", bed: "General", predicted: "~9 days", risk: "MED", riskType: "warning" as const },
  { hospital: "Mercy South General", bed: "Ventilator", predicted: "~22 days", risk: "LOW", riskType: "vacant" as const },
];

const GovAnalytics = () => (
  <div>
    <TopBar title="Predictive Analytics — Network-Wide" />
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Forecast Window:</span>
        {["7 Days", "14 Days", "30 Days"].map((w) => (
          <button key={w} className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">{w}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard title="ICU Beds — Network" value="4 hospitals" subtitle="Predicted to hit 0 in 7 days" status="critical">
          <p className="text-xs text-status-critical mt-1">▲ HIGH RISK</p>
        </MetricCard>
        <MetricCard title="General — Network" value="1 hospital" subtitle="Predicted to hit 0 in 10 days" status="warning">
          <p className="text-xs text-status-warning mt-1">▲ MODERATE RISK</p>
        </MetricCard>
        <MetricCard title="Ventilators — Network" value="No shortage" subtitle="Predicted in next 30 days" status="vacant">
          <p className="text-xs text-status-vacant mt-1">✓ LOW RISK</p>
        </MetricCard>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Multi-Hospital Trend Chart</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={forecastData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 20%)" />
            <XAxis dataKey="day" tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 12 }} />
            <YAxis tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 12 }} domain={[0, 100]} />
            <Tooltip contentStyle={{ backgroundColor: "hsl(220, 18%, 13%)", border: "1px solid hsl(220, 14%, 20%)", borderRadius: 8, color: "hsl(210, 20%, 92%)" }} />
            <Legend />
            <Line type="monotone" dataKey="icu" stroke="hsl(0, 72%, 51%)" strokeWidth={2} name="ICU (avg)" dot={false} />
            <Line type="monotone" dataKey="general" stroke="hsl(38, 92%, 50%)" strokeWidth={2} name="General" dot={false} />
            <Line type="monotone" dataKey="vent" stroke="hsl(210, 70%, 50%)" strokeWidth={2} name="Ventilator" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <h3 className="px-5 py-3 text-sm font-semibold text-foreground border-b border-border">Predicted Shortage Table</h3>
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Hospital</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Bed Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Predicted Shortage</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Risk</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shortages.map((s, i) => (
              <tr key={i} className="hover:bg-accent/50 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{s.hospital}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.bed}</td>
                <td className="px-4 py-3 text-muted-foreground">In {s.predicted}</td>
                <td className="px-4 py-3"><StatusBadge status={s.riskType} label={s.risk} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3">
        <Button variant="outline">Export as PDF</Button>
        <Button variant="outline">Export as CSV</Button>
        <Button>Send Report to All Hospitals</Button>
      </div>
    </div>
  </div>
);

export default GovAnalytics;
