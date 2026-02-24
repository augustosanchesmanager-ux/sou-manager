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
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Outlet } from 'react-router-dom';

const ProtectedRoute: React.FC = () => {
  const { session, loading } = useAuth();

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

  return <Outlet />;
};

const ManagerRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const role = user?.user_metadata?.role || '';
  if (role === 'Barber' || role === 'Receptionist') {
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

      {/* Protected Flow */}
      <Route element={<ProtectedRoute />}>
        {/* Onboarding Flow */}
        <Route path="/onboarding/role" element={<RoleSelection />} />
        <Route path="/onboarding/shop-setup" element={<ShopSetup />} />
        <Route path="/onboarding/professional-setup" element={<ProfessionalSetup />} />

        {/* Main Layout Routes */}
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/checkout/:id?" element={<Checkout />} />
          <Route path="/comandas" element={<Comandas />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/support" element={<Support />} />

          {/* Manager / Admin Routes */}
          <Route path="/financial" element={<ManagerRoute><Financial /></ManagerRoute>} />
          <Route path="/expenses" element={<ManagerRoute><Expenses /></ManagerRoute>} />
          <Route path="/receipts" element={<ManagerRoute><Receipts /></ManagerRoute>} />
          <Route path="/payroll" element={<ManagerRoute><Payroll /></ManagerRoute>} />
          <Route path="/reports" element={<ManagerRoute><Reports /></ManagerRoute>} />
          <Route path="/clients" element={<ManagerRoute><Clients /></ManagerRoute>} />
          <Route path="/services" element={<ManagerRoute><Services /></ManagerRoute>} />
          <Route path="/team" element={<ManagerRoute><Team /></ManagerRoute>} />
          <Route path="/performance" element={<ManagerRoute><Performance /></ManagerRoute>} />
          <Route path="/admin" element={<ManagerRoute><Admin /></ManagerRoute>} />
          <Route path="/operations" element={<ManagerRoute><Operations /></ManagerRoute>} />
          <Route path="/orders" element={<ManagerRoute><Orders /></ManagerRoute>} />
          <Route path="/orders/:id" element={<ManagerRoute><OrderDetails /></ManagerRoute>} />
          <Route path="/settings" element={<ManagerRoute><Settings /></ManagerRoute>} />
          <Route path="/products" element={<ManagerRoute><Products /></ManagerRoute>} />
          <Route path="/promotions" element={<ManagerRoute><Promotions /></ManagerRoute>} />
          <Route path="/bi" element={<ManagerRoute><BusinessIntelligence /></ManagerRoute>} />
          <Route path="/superadmin" element={<SuperAdmin />} />
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