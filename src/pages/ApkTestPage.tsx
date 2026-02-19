import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * APK Premium Testing Page
 * Redirects to the main app with ?mode=apk to simulate native APK behavior.
 * Open this URL on your phone: https://your-domain.com/apk-test
 */
export default function ApkTestPage() {
    const navigate = useNavigate();

    useEffect(() => {
        // Redirect to main app with APK mode flag and skip landing page
        navigate('/?mode=apk&skipLanding=true', { replace: true });
    }, [navigate]);

    return (
        <div className="fixed inset-0 bg-slate-950 flex items-center justify-center">
            <p className="text-white text-lg animate-pulse">Loading APK mode...</p>
        </div>
    );
}
