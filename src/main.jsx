import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

import { GoogleOAuthProvider } from '@react-oauth/google';

const WEB_CLIENT_ID = '407339918856-6vmd7ijqjgk435hp0a6jnc9bphhogljf.apps.googleusercontent.com';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={WEB_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
)
