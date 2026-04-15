export function occupancyColor(pct: number): string {
  if (pct >= 90) return 'bg-status-critical text-status-critical';
  if (pct >= 70) return 'bg-status-warning text-status-warning';
  return 'bg-status-vacant text-status-vacant';
}

export function occupancyStatus(pct: number): 'critical' | 'warning' | 'vacant' {
  if (pct >= 90) return 'critical';
  if (pct >= 70) return 'warning';
  return 'vacant';
}

export const STATUS_COLORS = {
  vacant: '#22C55E',
  warning: '#F59E0B',
  critical: '#EF4444',
  info: '#3B82F6',
  slate: '#7D99B6',
};
