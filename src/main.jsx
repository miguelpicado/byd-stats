import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

import { GoogleOAuthProvider } from '@react-oauth/google';
import { AppProvider } from './context/AppContext';
import { LayoutProvider } from './context/LayoutContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import './i18n';  // Initialize i18n

const WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={WEB_CLIENT_ID}>
      <AppProvider>
        <LayoutProvider>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </LayoutProvider>
      </AppProvider>
    </GoogleOAuthProvider>
  </StrictMode>,
)
