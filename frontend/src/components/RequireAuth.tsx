import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth, UserRole } from "@/contexts/AuthContext";

const DEFAULT_ROLE_ROUTE: Record<UserRole, string> = {
  HOSPITAL_ADMIN: "/admin/inventory",
  DOCTOR: "/doctor/overview",
  BED_MANAGER: "/bed-manager/entry",
  DATA_ENTRY: "/data-entry/entry",
  AMBULANCE_DRIVER: "/ambulance/dispatch",
  GOVERNMENT_OFFICIAL: "/gov/command-center",
};

const ALLOWED_PATH_PREFIX: Record<UserRole, string[]> = {
  HOSPITAL_ADMIN: ["/admin"],
  DOCTOR: ["/doctor"],
  BED_MANAGER: ["/bed-manager"],
  DATA_ENTRY: ["/data-entry"],
  AMBULANCE_DRIVER: ["/ambulance"],
  GOVERNMENT_OFFICIAL: ["/gov"],
};

const RequireAuth = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) return null;
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const allowedPrefixes = ALLOWED_PATH_PREFIX[user.role] || [];
  const isAllowed = allowedPrefixes.some((prefix) => location.pathname.startsWith(prefix));

  if (!isAllowed) {
    return <Navigate to={DEFAULT_ROLE_ROUTE[user.role]} replace />;
  }

  return <Outlet />;
};

export default RequireAuth;

