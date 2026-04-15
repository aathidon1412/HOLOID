import { useAuth } from "@/contexts/AuthContext";
import { Bell, User } from "lucide-react";
import { useState } from "react";
import NotificationPanel from "./holoid/NotificationPanel";

const TopBar = ({ title }: { title: string }) => {
  const { user } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-topbar px-6">
      <h1 className="text-base font-semibold text-foreground uppercase tracking-wider">{title}</h1>
      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <Bell size={18} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-status-critical border border-topbar" />
          </button>
          <NotificationPanel isOpen={showNotifications} onClose={() => setShowNotifications(false)} />
        </div>
        <div className="flex items-center gap-2 rounded-md bg-secondary/50 px-3 py-1.5 border border-border">
          <User size={14} className="text-muted-foreground" />
          <div className="flex flex-col -space-y-1">
            <span className="text-[11px] font-bold text-foreground">{user?.name}</span>
            <span className="text-[9px] text-muted-foreground uppercase tracking-tight">{user?.role?.replace('_', ' ')}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
