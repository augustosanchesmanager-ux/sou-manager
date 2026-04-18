import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './src/context/AppContext';
import { TenantProvider } from './src/context/TenantContext';
import { renderGuardedLayoutElement } from './src/app/core/routing/guards';
import { platformAdminRoutes } from './src/app/core/routing/platformAdminRoutes';
import { platformProtectedRoutes } from './src/app/core/routing/platformProtectedRoutes';
import { platformPublicRoutes } from './src/app/core/routing/platformPublicRoutes';
import {
  barberLegacyLayoutRoutes,
  barberProtectedLayoutRoutes,
  barberPublicRoutes,
} from './src/apps/barber/routes';
import { isInstitutionalHostname } from './src/lib/apps/publicUrl';
import { Outlet } from 'react-router-dom';

const HomeRoute: React.FC = () => {
  const { session, loading } = useAuth();
  const institutionalHost = isInstitutionalHostname(window.location.hostname);

  if (loading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center transition-colors duration-300">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (institutionalHost) {
    return session ? <Navigate to="/select-system" replace /> : <Landing />;
  }

  return <Navigate to={session ? '/dashboard' : '/login'} replace />;
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

  // Block pending or suspended users (Super Admins are always active)
  if (!isSuperAdmin && (profileStatus === 'pending' || profileStatus === 'suspended')) {
    return <Navigate to="/pending-approval" replace />;
  }

  return (
    <>
      <Outlet />
    </>
  );
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<HomeRoute />} />
      {platformPublicRoutes.map((route) => (
        <React.Fragment key={route.path}>
          <Route path={route.path} element={route.element} />
        </React.Fragment>
      ))}

      {/* Public Kiosk Routes — No auth required */}
      {barberPublicRoutes.map((route) => (
        <React.Fragment key={route.path}>
          <Route path={route.path} element={route.element} />
        </React.Fragment>
      ))}

      {/* Protected Flow */}
      <Route element={<ProtectedRoute />}>
        {platformProtectedRoutes.map((route) => (
          <React.Fragment key={route.path}>
            <Route path={route.path} element={route.element} />
          </React.Fragment>
        ))}

        {/* Main Layout Routes */}
        <Route element={<Layout />}>
          {barberProtectedLayoutRoutes.map((route) => (
            <React.Fragment key={route.path}>
              <Route
                path={route.path}
                element={renderGuardedLayoutElement(route.element, route.guard, route.module)}
              />
            </React.Fragment>
          ))}

          {barberLegacyLayoutRoutes.map((route) => (
            <React.Fragment key={route.path}>
              <Route
                path={route.path}
                element={renderGuardedLayoutElement(route.element, route.guard)}
              />
            </React.Fragment>
          ))}
          {platformAdminRoutes.map((route) => (
            <React.Fragment key={route.path}>
              <Route
                path={route.path}
                element={renderGuardedLayoutElement(route.element, route.guard)}
              />
            </React.Fragment>
          ))}
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
      <AppProvider>
        <AuthProvider>
          <TenantProvider>
            <HashRouter>
              <AppRoutes />
            </HashRouter>
          </TenantProvider>
        </AuthProvider>
      </AppProvider>
    </ThemeProvider>
  );
};

export default App;
