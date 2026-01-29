import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import App from '../App';

// Lazy load pages
const LegalPage = lazy(() => import('../pages/LegalPage'));
const FaqPage = lazy(() => import('../pages/FaqPage'));

const AppRoutes = () => {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-slate-950" />}>
            <Routes>
                <Route path="/legal" element={<LegalPage />} />
                <Route path="/privacidad" element={<LegalPage forcedTab="privacy" />} />
                <Route path="/faq" element={<FaqPage />} />
                <Route path="/*" element={<App />} />
            </Routes>
        </Suspense>
    );
};

export default AppRoutes;

