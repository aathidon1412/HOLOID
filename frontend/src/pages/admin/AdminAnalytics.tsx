import TopBar from "@/components/TopBar";
import MetricCard from "@/components/MetricCard";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { STATUS_COLORS } from "@/utils/statusColor";

const forecastData = [
  { day: "Today", icu: 47, general: 55, vent: 40, oxygen: 60 },
  { day: "Day 1", icu: 55, general: 58, vent: 42, oxygen: 63 },
  { day: "Day 2", icu: 64, general: 62, vent: 45, oxygen: 65 },
  { day: "Day 3", icu: 73, general: 67, vent: 48, oxygen: 68 },
  { day: "Day 4", icu: 82, general: 70, vent: 50, oxygen: 72 },
  { day: "Day 5", icu: 89, general: 73, vent: 52, oxygen: 75 },
  { day: "Day 7", icu: 96, general: 78, vent: 55, oxygen: 80 },
];

const historicalData = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  pct: 40 + Math.round(Math.random() * 50),
}));

const AdminAnalytics = () => {
  const [period, setPeriod] = useState(7);

  return (
    <div>
      <TopBar title="Predictive Analytics" />
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Forecast Window:</span>
          {[7, 14, 30].map((d) => (
            <button 
              key={d} 
              onClick={() => setPeriod(d)}
              className={`rounded-md border border-border px-3 py-1 text-xs transition-colors ${period === d ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
            >
              {d} Days
            </button>
          ))}
          <Button variant="outline" size="sm" className="ml-auto h-8 text-xs">Refresh Forecast</Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard title="ICU Beds" value="4 days" subtitle="Predicted full" status="critical">
            <p className="text-xs text-status-critical mt-1 font-bold">▲ High Risk</p>
          </MetricCard>
          <MetricCard title="General Beds" value="9 days" subtitle="Predicted full" status="warning">
            <p className="text-xs text-status-warning mt-1 font-bold">▲ Medium Risk</p>
          </MetricCard>
          <MetricCard title="Ventilators" value="12 days" subtitle="Predicted full" status="vacant">
            <p className="text-xs text-status-vacant mt-1 font-bold">✓ Low Risk</p>
          </MetricCard>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Bed Occupancy Trend — Next {period} Days</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={forecastData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 14%, 30%)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "hsl(210, 12%, 68%)", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(210, 12%, 68%)", fontSize: 11 }} domain={[0, 100]} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(214, 20%, 24%)", border: "1px solid hsl(214, 14%, 30%)", borderRadius: 8, color: "hsl(210, 10%, 90%)" }} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Line type="monotone" dataKey="icu" stroke={STATUS_COLORS.critical} strokeWidth={2.5} name="ICU" dot={false} />
              <Line type="monotone" dataKey="general" stroke={STATUS_COLORS.slate} strokeWidth={2} name="General" dot={false} />
              <Line type="monotone" dataKey="vent" stroke={STATUS_COLORS.warning} strokeWidth={2} name="Ventilator" dot={false} />
              <Line type="monotone" dataKey="oxygen" stroke={STATUS_COLORS.vacant} strokeWidth={2} name="Oxygen" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border-l-4 border-status-critical bg-card p-5 shadow-sm">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-sm font-bold text-foreground">⚠️ ICU beds predicted to reach 0 in 4 days</p>
              <p className="text-xs text-muted-foreground italic">Current: 14 ICU beds. Forecast rate: -3.5/day</p>
              <p className="text-xs text-status-critical font-medium">Recommendation: Initiate pre-emptive transfers immediately</p>
            </div>
            <Button size="sm" variant="destructive" className="h-8 text-xs">Start Transfer</Button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Historical Occupancy Data — Last 30 Days</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={historicalData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 14%, 30%)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "hsl(210, 12%, 68%)", fontSize: 10 }} />
              <YAxis tick={{ fill: "hsl(210, 12%, 68%)", fontSize: 11 }} domain={[0, 100]} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(214, 20%, 24%)", border: "1px solid hsl(214, 14%, 30%)", borderRadius: 8, color: "hsl(210, 10%, 90%)" }} />
              <Bar dataKey="pct" fill={STATUS_COLORS.slate} radius={[2, 2, 0, 0]} name="Occupancy %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;
