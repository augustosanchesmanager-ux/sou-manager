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
import Settings from './pages/Settings';
import Support from './pages/Support';
import Products from './pages/Products';
import SuperAdmin from './pages/SuperAdmin';
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

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected Flow */}
      <Route element={<ProtectedRoute />}>
        {/* Onboarding Flow */}
        <Route path="/onboarding/role" element={<RoleSelection />} />
        <Route path="/onboarding/shop-setup" element={<ShopSetup />} />
        <Route path="/onboarding/professional-setup" element={<ProfessionalSetup />} />

        {/* Main Layout Routes */}
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/financial" element={<Financial />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/services" element={<Services />} />
          <Route path="/checkout/:id?" element={<Checkout />} />
          <Route path="/comandas" element={<Comandas />} />
          <Route path="/team" element={<Team />} />
          <Route path="/performance" element={<Performance />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/operations" element={<Operations />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderDetails />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/support" element={<Support />} />
          <Route path="/products" element={<Products />} />
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