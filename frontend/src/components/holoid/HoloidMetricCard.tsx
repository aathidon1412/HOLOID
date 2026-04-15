import StatusDot from './StatusDot';
import ProgressBar from './ProgressBar';
import { occupancyStatus } from '@/utils/statusColor';

interface HoloidMetricCardProps {
  label: string;
  occupied: number;
  total: number;
}

const HoloidMetricCard = ({ label, occupied, total }: HoloidMetricCardProps) => {
  const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
  return (
    <div className="rounded-lg border border-border bg-card p-4 hover:shadow-md transition-all duration-200">
      <div className="flex justify-between items-start mb-3">
        <span className="text-muted-foreground text-xs uppercase tracking-wider font-medium">{label}</span>
        <StatusDot status={occupancyStatus(pct)} />
      </div>
      <div className="text-2xl font-bold text-foreground">
        {occupied} <span className="text-muted-foreground text-sm font-normal">/ {total}</span>
      </div>
      <div className="text-muted-foreground text-xs mb-3">{pct}% occupied</div>
      <ProgressBar pct={pct} />
    </div>
  );
};

export default HoloidMetricCard;
