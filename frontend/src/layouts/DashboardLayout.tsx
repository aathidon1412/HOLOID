import { Outlet } from "react-router-dom";
import AppSidebar from "@/components/AppSidebar";

const DashboardLayout = () => {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 ml-56">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;
