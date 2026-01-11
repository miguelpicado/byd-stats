import React from 'react';
import { BYD_RED } from '../utils/constants';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error", error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center text-white">
                    <div className="bg-slate-800 p-8 rounded-2xl max-w-md w-full border border-slate-700 shadow-2xl">
                        <div className="w-16 h-16 rounded-full bg-red-900/30 flex items-center justify-center mx-auto mb-6">
                            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h1 className="text-xl font-bold mb-2">Algo salió mal</h1>
                        <p className="text-slate-400 text-sm mb-6">
                            La aplicación ha encontrado un error inesperado al renderizar.
                        </p>

                        <div className="bg-black/30 p-4 rounded-xl text-left overflow-auto max-h-40 mb-6 border border-slate-700">
                            <code className="text-xs text-red-400 font-mono break-all">
                                {this.state.error && this.state.error.toString()}
                            </code>
                        </div>

                        <button
                            onClick={() => {
                                localStorage.removeItem('byd_stats_data'); // Clear potentially bad data
                                window.location.reload();
                            }}
                            className="w-full py-3 rounded-xl font-medium text-white transition-opacity hover:opacity-90"
                            style={{ backgroundColor: BYD_RED || '#ea0029' }}
                        >
                            Reiniciar y Borrar Caché
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
