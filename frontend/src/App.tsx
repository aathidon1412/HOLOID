import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import DashboardLayout from "@/layouts/DashboardLayout";
import LoginPage from "@/pages/LoginPage";
import ActivateAccountPage from "@/pages/ActivateAccountPage";
import RequireAuth from "@/components/RequireAuth";
import AdminInventory from "@/pages/admin/AdminInventory";
import AdminTransfers from "@/pages/admin/AdminTransfers";
import AdminAlerts from "@/pages/admin/AdminAlerts";
import AdminAnalytics from "@/pages/admin/AdminAnalytics";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminUsers from "@/pages/admin/AdminUsers";
import DoctorOverview from "@/pages/doctor/DoctorOverview";
import DoctorRequestTransfer from "@/pages/doctor/DoctorRequestTransfer";
import DoctorTransfers from "@/pages/doctor/DoctorTransfers";
import DoctorHistory from "@/pages/doctor/DoctorHistory";
import DoctorSettings from "@/pages/doctor/DoctorSettings";
import GovCommandCenter from "@/pages/gov/GovCommandCenter";
import GovMap from "@/pages/gov/GovMap";
import GovTransfers from "@/pages/gov/GovTransfers";
import GovAnalytics from "@/pages/gov/GovAnalytics";
import GovAuditLogs from "@/pages/gov/GovAuditLogs";
import GovHospitals from "@/pages/gov/GovHospitals";
import GovUsers from "@/pages/gov/GovUsers";
import GovSettings from "@/pages/gov/GovSettings";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/activate" element={<ActivateAccountPage />} />

            <Route element={<RequireAuth />}>
              {/* Hospital Admin Routes */}
              <Route element={<DashboardLayout />}>
                <Route path="/admin/inventory" element={<AdminInventory />} />
                <Route path="/admin/transfers" element={<AdminTransfers />} />
                <Route path="/admin/alerts" element={<AdminAlerts />} />
                <Route path="/admin/analytics" element={<AdminAnalytics />} />
                <Route path="/admin/settings" element={<AdminSettings />} />
                <Route path="/admin/users" element={<AdminUsers />} />
              </Route>

              {/* Doctor Routes */}
              <Route element={<DashboardLayout />}>
                <Route path="/doctor/overview" element={<DoctorOverview />} />
                <Route path="/doctor/request-transfer" element={<DoctorRequestTransfer />} />
                <Route path="/doctor/transfers" element={<DoctorTransfers />} />
                <Route path="/doctor/history" element={<DoctorHistory />} />
                <Route path="/doctor/settings" element={<DoctorSettings />} />
              </Route>

              {/* Government Official Routes */}
              <Route element={<DashboardLayout />}>
                <Route path="/gov/command-center" element={<GovCommandCenter />} />
                <Route path="/gov/map" element={<GovMap />} />
                <Route path="/gov/transfers" element={<GovTransfers />} />
                <Route path="/gov/analytics" element={<GovAnalytics />} />
                <Route path="/gov/audit-logs" element={<GovAuditLogs />} />
                <Route path="/gov/hospitals" element={<GovHospitals />} />
                <Route path="/gov/users" element={<GovUsers />} />
                <Route path="/gov/settings" element={<GovSettings />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
