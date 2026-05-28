import React, { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Toaster } from 'react-hot-toast';
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
                                    <Toaster
                                        position="bottom-center"
                                        containerStyle={{
                                            bottom: 100, // Move it up to clear the bottom navigation bar
                                        }}
                                        toastOptions={{
                                            duration: 4000,
                                            style: {
                                                background: 'rgba(15, 23, 42, 0.85)',
                                                color: '#fff',
                                                backdropFilter: 'blur(12px) saturate(180%)',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                borderRadius: '16px',
                                                padding: '12px 20px',
                                                fontSize: '14px',
                                                fontWeight: '500',
                                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
                                                maxWidth: '350px',
                                            },
                                            success: {
                                                iconTheme: {
                                                    primary: '#10b981',
                                                    secondary: '#fff',
                                                },
                                                style: {
                                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                                }
                                            },
                                            error: {
                                                iconTheme: {
                                                    primary: '#EA0029',
                                                    secondary: '#fff',
                                                },
                                                style: {
                                                    border: '1px solid rgba(234, 0, 41, 0.3)',
                                                }
                                            },
                                            loading: {
                                                style: {
                                                    background: 'rgba(30, 41, 59, 0.9)',
                                                }
                                            }
                                        }}
                                    />
                                </BrowserRouter>
                            </DataProvider>
                        </ErrorBoundary>
                    </LayoutProvider>
                </AppProvider>
            </CarProvider>
        </GoogleOAuthProvider>
    );
};
