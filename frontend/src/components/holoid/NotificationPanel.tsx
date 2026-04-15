import { useState } from 'react';
import { mockNotifications } from '@/mocks/mockNotifications';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationPanel = ({ isOpen, onClose }: NotificationPanelProps) => {
  const [notifications] = useState(mockNotifications);
  const unread = notifications.filter(n => !n.read).length;

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute top-14 right-4 z-50 w-80 bg-card border border-border rounded-lg shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
        <div className="flex justify-between items-center p-3 border-b border-border">
          <span className="text-foreground text-sm font-medium">🔔 Notifications ({unread} new)</span>
          <button className="text-muted-foreground text-xs hover:text-foreground">Mark all read</button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.map(n => (
            <div key={n.id} className="p-3 border-b border-border/50 hover:bg-accent/50 transition-colors">
              <div className="flex items-start gap-2">
                <span className={`status-dot status-dot-${n.type} mt-1.5`} />
                <div className="flex-1">
                  <div className="flex justify-between">
                    <span className="text-foreground text-sm font-medium">{n.title}</span>
                    <span className="text-muted-foreground text-xs">{n.time}</span>
                  </div>
                  <p className="text-muted-foreground text-xs mt-0.5">{n.subtitle}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="p-2 text-center border-t border-border">
          <button className="text-primary text-sm hover:underline">View All Notifications</button>
        </div>
      </div>
    </>
  );
};

export default NotificationPanel;
