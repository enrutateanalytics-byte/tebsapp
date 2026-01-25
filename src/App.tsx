import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import RoutesPage from "./pages/Routes";
import Units from "./pages/Units";
import Assignments from "./pages/Assignments";
import Tracking from "./pages/Tracking";
import DashboardLayout from "./components/layout/DashboardLayout";
import NotFound from "./pages/NotFound";
import PublicLogin from "./pages/PublicLogin";
import PublicApp from "./pages/PublicApp";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            {/* Admin login */}
            <Route path="/login" element={<Login />} />
            {/* Public routes for client users */}
            <Route path="/public-login" element={<PublicLogin />} />
            <Route path="/app" element={<PublicApp />} />
            {/* Admin routes */}
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/routes" element={<RoutesPage />} />
              <Route path="/units" element={<Units />} />
              <Route path="/assignments" element={<Assignments />} />
              <Route path="/tracking" element={<Tracking />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
