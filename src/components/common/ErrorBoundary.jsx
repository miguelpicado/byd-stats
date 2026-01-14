// BYD Stats - Error Boundary Component
// Catches React component errors and displays fallback UI
import { Component } from 'react';
import PropTypes from 'prop-types';
import { logger } from '../../utils/logger';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // Log the error to our logging service
        logger.error('[ErrorBoundary] Component error caught:', error, errorInfo);

        this.setState({
            error,
            errorInfo
        });

        // In production, you could send this to an error tracking service
        // For now, we just log it
        if (import.meta.env.PROD) {
            // Could send to Sentry, LogRocket, etc.
            console.error('Production error:', error, errorInfo);
        }
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
    };

    render() {
        if (this.state.hasError) {
            // Fallback UI
            return (
                <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 sm:p-8">
                        <div className="text-center">
                            {/* Error Icon */}
                            <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
                                <svg
                                    className="w-8 h-8 text-red-600 dark:text-red-400"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                    />
                                </svg>
                            </div>

                            {/* Error Message */}
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                                Algo salió mal
                            </h2>
                            <p className="text-slate-600 dark:text-slate-400 mb-6">
                                La aplicación ha encontrado un error inesperado. Puedes intentar recargar la página.
                            </p>

                            {/* Error Details (Development Only) */}
                            {import.meta.env.DEV && this.state.error && (
                                <details className="text-left mb-6 p-4 bg-slate-100 dark:bg-slate-900 rounded-lg text-sm">
                                    <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Detalles del error (solo en desarrollo)
                                    </summary>
                                    <pre className="text-xs text-red-600 dark:text-red-400 overflow-auto">
                                        {this.state.error.toString()}
                                        {'\n\n'}
                                        {this.state.errorInfo?.componentStack}
                                    </pre>
                                </details>
                            )}

                            {/* Actions */}
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={this.handleReset}
                                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                                >
                                    Intentar de nuevo
                                </button>
                                <button
                                    onClick={() => window.location.reload()}
                                    className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg font-medium transition-colors"
                                >
                                    Recargar página
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

ErrorBoundary.propTypes = {
    children: PropTypes.node.isRequired
};

export default ErrorBoundary;
