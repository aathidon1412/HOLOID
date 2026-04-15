import { occupancyColor } from '@/utils/statusColor';

const ProgressBar = ({ pct }: { pct: number }) => {
  return (
    <div className="progress-bar-track">
      <div 
        className={`progress-bar-fill ${occupancyColor(pct).split(' ')[0]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};

export default ProgressBar;
