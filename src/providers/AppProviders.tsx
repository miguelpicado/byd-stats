import React, { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { CarProvider } from '../context/CarContext';
import { AppProvider } from '../context/AppContext';
import { LayoutProvider } from '../context/LayoutContext';
import { DataProvider } from './DataProvider';
import ErrorBoundary from '@/components/common/ErrorBoundary';

const WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined;

if (!WEB_CLIENT_ID && import.meta.env.DEV) {
    console.warn(
        '[BYD Stats] VITE_GOOGLE_WEB_CLIENT_ID no está configurado.\n' +
        'Crea un archivo .env en la raíz con:\n' +
        'VITE_GOOGLE_WEB_CLIENT_ID=<tu-client-id>.apps.googleusercontent.com\n' +
        'El login con Google no funcionará hasta que lo configures.'
    );
}

export const AppProviders: React.FC<{ children: ReactNode }> = ({ children }) => {
    return (
        <GoogleOAuthProvider clientId={WEB_CLIENT_ID ?? ''}>
            <CarProvider>
                <AppProvider>
                    <LayoutProvider>
                        <ErrorBoundary>
                            <DataProvider>
                                <BrowserRouter>
                                    {children}
                                </BrowserRouter>
                            </DataProvider>
                        </ErrorBoundary>
                    </LayoutProvider>
                </AppProvider>
            </CarProvider>
        </GoogleOAuthProvider>
    );
};
