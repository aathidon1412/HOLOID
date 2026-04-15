const LiveBadge = () => {
  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-status-critical/10 border border-status-critical/20">
      <span className="w-2 h-2 rounded-full bg-status-critical pulse-live" />
      <span className="text-[10px] font-bold text-status-critical uppercase tracking-tighter">Live</span>
    </div>
  );
};

export default LiveBadge;
