import React, { Suspense, lazy } from 'react';
import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { PortalAuthProvider } from './components/PortalAuthProvider';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoadingProvider } from './context/LoadingContext';
import { ThemeProvider } from './context/ThemeContext';
import { buildAppUrl, isInstitutionalHostname } from './src/lib/apps/publicUrl';
import { AppProvider } from './src/context/AppContext';
import { TenantProvider } from './src/context/TenantContext';

const Layout = lazy(() => import('./components/Layout'));
const Admin = lazy(() => import('./pages/Admin'));
const BusinessIntelligence = lazy(() => import('./pages/BusinessIntelligence'));
const Cashflow = lazy(() => import('./pages/Cashflow'));
const Categories = lazy(() => import('./pages/Categories'));
const Checkout = lazy(() => import('./pages/Checkout'));
const ChefClubPlans = lazy(() => import('./pages/ChefClubPlans'));
const ChefClubReceivables = lazy(() => import('./pages/ChefClubReceivables'));
const ChefClubSubscriptionDetail = lazy(() => import('./pages/ChefClubSubscriptionDetail'));
const ChefClubSubscriptionNew = lazy(() => import('./pages/ChefClubSubscriptionNew'));
const ChefClubSubscriptions = lazy(() => import('./pages/ChefClubSubscriptions'));
const Clients = lazy(() => import('./pages/Clients'));
const Comandas = lazy(() => import('./pages/Comandas'));
const Commissions = lazy(() => import('./pages/Commissions'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Financial = lazy(() => import('./pages/Financial'));
const FinancialOverview = lazy(() => import('./pages/FinancialOverview'));
const CashClosingPage = lazy(() => import('./pages/CashClosingPage'));
const KioskAdmin = lazy(() => import('./pages/KioskAdmin'));
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Operations = lazy(() => import('./pages/Operations'));
const OperationSuccess = lazy(() => import('./pages/OperationSuccess'));
const OrderDetails = lazy(() => import('./pages/OrderDetails'));
const Orders = lazy(() => import('./pages/Orders'));
const Payroll = lazy(() => import('./pages/Payroll'));
const PendingApproval = lazy(() => import('./pages/PendingApproval'));
const Performance = lazy(() => import('./pages/Performance'));
const Products = lazy(() => import('./pages/Products'));
const ProfessionalSetup = lazy(() => import('./pages/onboarding/ProfessionalSetup'));
const Promotions = lazy(() => import('./pages/Promotions'));
const Receipts = lazy(() => import('./pages/Receipts'));
const Register = lazy(() => import('./pages/Register'));
const RegisterSuccess = lazy(() => import('./pages/RegisterSuccess'));
const Reports = lazy(() => import('./pages/Reports'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const RoleSelection = lazy(() => import('./pages/onboarding/RoleSelection'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Services = lazy(() => import('./pages/Services'));
const Settings = lazy(() => import('./pages/Settings'));
const ShopSetup = lazy(() => import('./pages/onboarding/ShopSetup'));
const SmartReturn = lazy(() => import('./pages/SmartReturn'));
const StrategicDashboard = lazy(() => import('./pages/StrategicDashboard'));
const SupabaseMonitoring = lazy(() => import('./pages/SupabaseMonitoring'));
const SuperAdmin = lazy(() => import('./pages/SuperAdmin'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Support = lazy(() => import('./pages/Support'));
const Team = lazy(() => import('./pages/Team'));
const KioskClientPage = lazy(() => import('./pages/kiosk/KioskClientPage'));
const KioskPage = lazy(() => import('./pages/kiosk/KioskPage'));
const PortalAdmin = lazy(() => import('./pages/portal/PortalAdmin'));
const PortalApp = lazy(() => import('./pages/portal/PortalApp'));
const PortalLanding = lazy(() => import('./pages/portal/PortalLanding'));
const PortalLogin = lazy(() => import('./pages/portal/PortalLogin'));
const PortalSchedule = lazy(() => import('./pages/portal/PortalSchedule'));

const RouteFallback: React.FC = () => (
  <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center transition-colors duration-300">
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-border-dark bg-white/90 dark:bg-card-dark/90 px-5 py-4 shadow-sm">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-b-primary" />
      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Carregando modulo...</span>
    </div>
  </div>
);

const InstitutionalAppRedirect: React.FC = () => {
  const { loading, session, tenant, memberships, isSuperAdmin } = useAuth();

  React.useEffect(() => {
    if (loading || !session || isSuperAdmin || !isInstitutionalHostname(window.location.hostname)) {
      return;
    }

    const targetAppSlug =
      memberships.find((membership) => membership.isPrimary && membership.tenant?.app_slug)?.tenant?.app_slug ||
      memberships.find((membership) => membership.tenant?.app_slug)?.tenant?.app_slug ||
      tenant?.app_slug;

    if (!targetAppSlug) {
      return;
    }

    window.location.replace(buildAppUrl(targetAppSlug, window.location.hash || '/dashboard'));
  }, [isSuperAdmin, loading, memberships, session, tenant]);

  return null;
};

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

  if (!isSuperAdmin && (profileStatus === 'pending' || profileStatus === 'suspended')) {
    return <Navigate to="/pending-approval" replace />;
  }

  return (
    <>
      <InstitutionalAppRedirect />
      <Outlet />
    </>
  );
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
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/register-success" element={<RegisterSuccess />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/pending-approval" element={<PendingApproval />} />

        <Route path="/kiosk/:tenantSlug" element={<KioskPage />} />
        <Route path="/kiosk/:tenantSlug/client" element={<KioskClientPage />} />

        <Route path="/c/:tenantSlug" element={<PortalLanding />} />
        <Route path="/c/:tenantSlug/login" element={<PortalAuthProvider><PortalLogin /></PortalAuthProvider>} />
        <Route path="/c/:tenantSlug/app" element={<PortalAuthProvider><PortalApp /></PortalAuthProvider>} />
        <Route path="/c/:tenantSlug/app/schedule" element={<PortalAuthProvider><PortalSchedule /></PortalAuthProvider>} />

        <Route element={<ProtectedRoute />}>
          <Route path="/onboarding/role" element={<RoleSelection />} />
          <Route path="/onboarding/shop-setup" element={<ShopSetup />} />
          <Route path="/onboarding/professional-setup" element={<ProfessionalSetup />} />

          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/strategic-dashboard" element={<StrategicDashboard />} />
            <Route path="/checkout/:id?" element={<Checkout />} />
            <Route path="/comandas" element={<Comandas />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/operation-success" element={<OperationSuccess />} />
            <Route path="/support" element={<Support />} />

            <Route path="/admin" element={<ManagerRoute><Admin /></ManagerRoute>} />
            <Route path="/admin/supabase-monitoring" element={<ManagerRoute><SupabaseMonitoring /></ManagerRoute>} />
            <Route path="/team" element={<ManagerRoute><Team /></ManagerRoute>} />
            <Route path="/kiosk-admin" element={<ManagerRoute><KioskAdmin /></ManagerRoute>} />
            <Route path="/portal-admin" element={<ManagerRoute><PortalAdmin /></ManagerRoute>} />
            <Route path="/settings" element={<ManagerRoute><Settings /></ManagerRoute>} />
            <Route path="/clients" element={<ManagerRoute><Clients /></ManagerRoute>} />
            <Route path="/bi" element={<ManagerRoute><BusinessIntelligence /></ManagerRoute>} />
            <Route path="/smart-return" element={<ManagerRoute><SmartReturn /></ManagerRoute>} />
            <Route path="/chef-club-plans" element={<ManagerRoute><ChefClubPlans /></ManagerRoute>} />
            <Route path="/chef-club-receivables" element={<ManagerRoute><ChefClubReceivables /></ManagerRoute>} />
            <Route path="/chef-club-subscriptions" element={<ManagerRoute><ChefClubSubscriptions /></ManagerRoute>} />
            <Route path="/chef-club-subscriptions/new" element={<ManagerRoute><ChefClubSubscriptionNew /></ManagerRoute>} />
            <Route path="/chef-club-subscriptions/:subscriptionId" element={<ManagerRoute><ChefClubSubscriptionDetail /></ManagerRoute>} />

            <Route path="/financial" element={<Navigate to="/financial-overview" replace />} />
            <Route path="/financial-overview" element={<ManagerRoute><FinancialOverview /></ManagerRoute>} />
            <Route path="/cashflow" element={<ManagerRoute><Cashflow /></ManagerRoute>} />
            <Route path="/cash-closing" element={<ManagerRoute><CashClosingPage /></ManagerRoute>} />
            <Route path="/expenses" element={<ManagerRoute><Expenses /></ManagerRoute>} />
            <Route path="/receipts" element={<ManagerRoute><Receipts /></ManagerRoute>} />
            <Route path="/accounts-receivable" element={<Navigate to="/receipts" replace />} />
            <Route path="/payroll" element={<ManagerRoute><Payroll /></ManagerRoute>} />
            <Route path="/commissions" element={<ManagerRoute><Commissions /></ManagerRoute>} />
            <Route path="/reports" element={<ManagerRoute><Reports /></ManagerRoute>} />
            <Route path="/services" element={<ManagerRoute><Services /></ManagerRoute>} />
            <Route path="/performance" element={<ManagerRoute><Performance /></ManagerRoute>} />
            <Route path="/operations" element={<ManagerRoute><Operations /></ManagerRoute>} />
            <Route path="/orders" element={<ManagerRoute><Orders /></ManagerRoute>} />
            <Route path="/orders/:id" element={<ManagerRoute><OrderDetails /></ManagerRoute>} />
            <Route path="/products" element={<ManagerRoute><Products /></ManagerRoute>} />
            <Route path="/categories" element={<ManagerRoute><Categories /></ManagerRoute>} />
            <Route path="/suppliers" element={<ManagerRoute><Suppliers /></ManagerRoute>} />
            <Route path="/promotions" element={<ManagerRoute><Promotions /></ManagerRoute>} />
            <Route path="/superadmin" element={<SuperAdminRoute><SuperAdmin /></SuperAdminRoute>} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <LoadingProvider>
        <AppProvider>
          <AuthProvider>
            <TenantProvider>
              <HashRouter>
                <AppRoutes />
              </HashRouter>
            </TenantProvider>
          </AuthProvider>
        </AppProvider>
      </LoadingProvider>
    </ThemeProvider>
  );
};

export default App;
