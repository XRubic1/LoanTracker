import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import App from './App';
import { AaaFuelPortal } from '@/pages/AaaFuelPortal';
import './index.css';
import { installTableSort } from '@/lib/tableSort';

installTableSort();

/** The AAA Fuel sister company only ever gets its own portal, never the main app. */
function Root() {
  const { user, isAaaFuel, loading } = useAuth();
  if (!loading && user && isAaaFuel) return <AaaFuelPortal />;
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
);
