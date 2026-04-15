const LiveIndicator = () => (
  <div className="flex items-center gap-2 text-sm">
    <span className="relative flex h-2.5 w-2.5">
      <span className="pulse-live absolute inline-flex h-full w-full rounded-full bg-status-critical opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-status-critical" />
    </span>
    <span className="text-status-critical font-medium">LIVE</span>
    <span className="text-muted-foreground">— Real-time updates</span>
  </div>
);

export default LiveIndicator;
