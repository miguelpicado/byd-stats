import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AppProviders } from './providers/AppProviders';
import AppRoutes from './routes/AppRoutes';
import ThemeManager from './components/ThemeManager';
import './i18n';

createRoot(document.getElementById('root')).render(
  <AppProviders>
    <ThemeManager />
    <AppRoutes />
  </AppProviders>
)

