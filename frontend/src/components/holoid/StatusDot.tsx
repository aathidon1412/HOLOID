const StatusDot = ({ status }: { status: 'critical' | 'warning' | 'vacant' | 'info' }) => {
  const dotClass = status === 'critical' ? 'crit' : status === 'warning' ? 'maint' : status;
  return <span className={`status-dot status-dot-${dotClass}`} />;
};

export default StatusDot;
