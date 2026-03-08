import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Login from './pages/Login';
import Register from './pages/Register';
import Schedule from './pages/Schedule';
import Financial from './pages/Financial';
import Services from './pages/Services';
import Team from './pages/Team';
import Reports from './pages/Reports';
import Performance from './pages/Performance';
import Expenses from './pages/Expenses';
import Receipts from './pages/Receipts';
import Payroll from './pages/Payroll';
import Checkout from './pages/Checkout';
import Comandas from './pages/Comandas';
import Admin from './pages/Admin';
import Operations from './pages/Operations';
import Orders from './pages/Orders';
import OrderDetails from './pages/OrderDetails';
import RoleSelection from './pages/onboarding/RoleSelection';
import ShopSetup from './pages/onboarding/ShopSetup';
import ProfessionalSetup from './pages/onboarding/ProfessionalSetup';
import Landing from './pages/Landing';
import ResetPassword from './pages/ResetPassword';
import RegisterSuccess from './pages/RegisterSuccess';
import Settings from './pages/Settings';
import Support from './pages/Support';
import Products from './pages/Products';
import SuperAdmin from './pages/SuperAdmin';
import Promotions from './pages/Promotions';
import BusinessIntelligence from './pages/BusinessIntelligence';
import SmartReturn from './pages/SmartReturn';
import StrategicDashboard from './pages/StrategicDashboard';
import PendingApproval from './pages/PendingApproval';
import KioskAdmin from './pages/KioskAdmin';
import KioskPage from './pages/kiosk/KioskPage';
import KioskClientPage from './pages/kiosk/KioskClientPage';
import PortalLanding from './pages/portal/PortalLanding';
import PortalLogin from './pages/portal/PortalLogin';
import PortalApp from './pages/portal/PortalApp';
import PortalSchedule from './pages/portal/PortalSchedule';
import PortalAdmin from './pages/portal/PortalAdmin';
import ChefClubPlans from './pages/ChefClubPlans';
import ChefClubSubscriptions from './pages/ChefClubSubscriptions';
import { PortalAuthProvider } from './components/PortalAuthProvider';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Outlet } from 'react-router-dom';

const ProtectedRoute: React.FC = () => {
  const { session, loading, profileStatus, isSuperAdmin, authError } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center transition-colors duration-300">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center transition-colors duration-300">
        <div className="max-w-md w-full bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-2xl p-6 text-center">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Falha de seguranca da sessao</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{authError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors"
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }

  // Block pending or suspended users (Super Admins are always active)
  if (!isSuperAdmin && (profileStatus === 'pending' || profileStatus === 'suspended')) {
    return <Navigate to="/pending-approval" replace />;
  }

  return <Outlet />;
};

const ManagerRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { accessRole } = useAuth();
  if (accessRole === 'barber' || accessRole === 'receptionist') {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

const SuperAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { canAccessSuperAdmin } = useAuth();
  if (!canAccessSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/register-success" element={<RegisterSuccess />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/pending-approval" element={<PendingApproval />} />

      {/* Public Kiosk Routes — No auth required */}
      <Route path="/kiosk/:tenantSlug" element={<KioskPage />} />
      <Route path="/kiosk/:tenantSlug/client" element={<KioskClientPage />} />

      {/* Public Portal Routes */}
      <Route path="/c/:tenantSlug" element={<PortalLanding />} />
      <Route path="/c/:tenantSlug/login" element={<PortalAuthProvider><PortalLogin /></PortalAuthProvider>} />
      <Route path="/c/:tenantSlug/app" element={<PortalAuthProvider><PortalApp /></PortalAuthProvider>} />
      <Route path="/c/:tenantSlug/app/schedule" element={<PortalAuthProvider><PortalSchedule /></PortalAuthProvider>} />

      {/* Protected Flow */}
      <Route element={<ProtectedRoute />}>
        {/* Onboarding Flow */}
        <Route path="/onboarding/role" element={<RoleSelection />} />
        <Route path="/onboarding/shop-setup" element={<ShopSetup />} />
        <Route path="/onboarding/professional-setup" element={<ProfessionalSetup />} />

        {/* Main Layout Routes */}
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/strategic-dashboard" element={<StrategicDashboard />} />
          <Route path="/checkout/:id?" element={<Checkout />} />
          <Route path="/comandas" element={<Comandas />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/support" element={<Support />} />

          {/* Admin Settings & Features */}
          <Route path="/admin" element={<ManagerRoute><Admin /></ManagerRoute>} />
          <Route path="/team" element={<ManagerRoute><Team /></ManagerRoute>} />
          <Route path="/kiosk-admin" element={<ManagerRoute><KioskAdmin /></ManagerRoute>} />
          <Route path="/portal-admin" element={<ManagerRoute><PortalAdmin /></ManagerRoute>} />
          <Route path="/settings" element={<ManagerRoute><Settings /></ManagerRoute>} />
          <Route path="/clients" element={<ManagerRoute><Clients /></ManagerRoute>} />
          <Route path="/bi" element={<ManagerRoute><BusinessIntelligence /></ManagerRoute>} />
          <Route path="/smart-return" element={<ManagerRoute><SmartReturn /></ManagerRoute>} />
          <Route path="/chef-club-plans" element={<ManagerRoute><ChefClubPlans /></ManagerRoute>} />
          <Route path="/chef-club-subscriptions" element={<ManagerRoute><ChefClubSubscriptions /></ManagerRoute>} />

          {/* Manager / Admin Routes */}
          <Route path="/financial" element={<ManagerRoute><Financial /></ManagerRoute>} />
          <Route path="/expenses" element={<ManagerRoute><Expenses /></ManagerRoute>} />
          <Route path="/receipts" element={<ManagerRoute><Receipts /></ManagerRoute>} />
          <Route path="/payroll" element={<ManagerRoute><Payroll /></ManagerRoute>} />
          <Route path="/reports" element={<ManagerRoute><Reports /></ManagerRoute>} />
          <Route path="/services" element={<ManagerRoute><Services /></ManagerRoute>} />
          <Route path="/performance" element={<ManagerRoute><Performance /></ManagerRoute>} />
          <Route path="/operations" element={<ManagerRoute><Operations /></ManagerRoute>} />
          <Route path="/orders" element={<ManagerRoute><Orders /></ManagerRoute>} />
          <Route path="/orders/:id" element={<ManagerRoute><OrderDetails /></ManagerRoute>} />
          <Route path="/products" element={<ManagerRoute><Products /></ManagerRoute>} />
          <Route path="/promotions" element={<ManagerRoute><Promotions /></ManagerRoute>} />
          <Route path="/superadmin" element={<SuperAdminRoute><SuperAdmin /></SuperAdminRoute>} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
