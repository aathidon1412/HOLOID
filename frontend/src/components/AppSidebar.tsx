import { NavLink, useNavigate } from "react-router-dom";
import { useAuth, UserRole } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, ArrowLeftRight, Bell, BarChart3, Settings, LogOut,
  Stethoscope, ClipboardList, History, MapPin, FileText, Building2, Users
} from "lucide-react";
import holoidLogo from "@/assets/holoid_logo.png";

interface SidebarLink {
  to: string;
  icon: React.ReactNode;
  label: string;
}

const adminLinks: SidebarLink[] = [
  { to: "/admin/inventory", icon: <LayoutDashboard size={18} />, label: "Resource Inventory" },
  { to: "/admin/transfers", icon: <ArrowLeftRight size={18} />, label: "Transfers & Ambulance" },
  { to: "/admin/alerts", icon: <Bell size={18} />, label: "Alerts & Notifications" },
  { to: "/admin/analytics", icon: <BarChart3 size={18} />, label: "Analytics" },
  { to: "/admin/users", icon: <Users size={18} />, label: "User Management" },
  { to: "/admin/settings", icon: <Settings size={18} />, label: "Settings" },
];

const doctorLinks: SidebarLink[] = [
  { to: "/doctor/overview", icon: <Stethoscope size={18} />, label: "Hospital Overview" },
  { to: "/doctor/request-transfer", icon: <ArrowLeftRight size={18} />, label: "Request Transfer" },
  { to: "/doctor/transfers", icon: <ClipboardList size={18} />, label: "Active Transfers" },
  { to: "/doctor/history", icon: <History size={18} />, label: "Transfer History" },
  { to: "/doctor/settings", icon: <Settings size={18} />, label: "Settings" },
];

const govLinks: SidebarLink[] = [
  { to: "/gov/command-center", icon: <LayoutDashboard size={18} />, label: "Command Center" },
  { to: "/gov/map", icon: <MapPin size={18} />, label: "Regional Bed Map" },
  { to: "/gov/transfers", icon: <ArrowLeftRight size={18} />, label: "Transfer History" },
  { to: "/gov/analytics", icon: <BarChart3 size={18} />, label: "Predictive Analytics" },
  { to: "/gov/audit-logs", icon: <FileText size={18} />, label: "Audit Logs" },
  { to: "/gov/hospitals", icon: <Building2 size={18} />, label: "Hospital Registry" },
  { to: "/gov/users", icon: <Users size={18} />, label: "User Management" },
  { to: "/gov/settings", icon: <Settings size={18} />, label: "Settings" },
];

const linksByRole: Record<UserRole, SidebarLink[]> = {
  HOSPITAL_ADMIN: adminLinks,
  DOCTOR: doctorLinks,
  GOVERNMENT_OFFICIAL: govLinks,
};

const roleLabels: Record<UserRole, string> = {
  HOSPITAL_ADMIN: "Hospital Admin",
  DOCTOR: "Doctor",
  GOVERNMENT_OFFICIAL: "Gov. Official",
};

const AppSidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const links = linksByRole[user.role];

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-56 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-4">
        <img src={holoidLogo} alt="HOLOID" className="h-8" />
        <span className="text-sm font-bold text-foreground">HOLOID</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )
            }
          >
            {link.icon}
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3 space-y-2">
        <div className="px-3 py-2">
          <p className="text-xs font-medium text-foreground truncate">{user.name}</p>
          <p className="text-xs text-muted-foreground">{roleLabels[user.role]}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;
