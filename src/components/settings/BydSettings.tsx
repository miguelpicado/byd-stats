/**
 * BYD Direct API Settings Component
 * Connect and manage BYD account (alternative to Smartcar)
 */

import React, { useState, useEffect } from 'react';
import {
    bydConnect,
    bydDisconnect,
    bydDiagnostic,
    bydGetRealtime,
    bydGetGps,
    BydVehicle,
    BydRealtime,
    BydGps,
    BydDiagnostic,
} from '../../services/bydApi';
import { waitForAuth } from '../../services/firebase';

// Country codes for BYD API
const COUNTRY_CODES = [
    { code: 'ES', name: 'España' },
    { code: 'DE', name: 'Germany' },
    { code: 'FR', name: 'France' },
    { code: 'IT', name: 'Italy' },
    { code: 'NL', name: 'Netherlands' },
    { code: 'BE', name: 'Belgium' },
    { code: 'AT', name: 'Austria' },
    { code: 'PT', name: 'Portugal' },
    { code: 'SE', name: 'Sweden' },
    { code: 'NO', name: 'Norway' },
    { code: 'DK', name: 'Denmark' },
    { code: 'FI', name: 'Finland' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'IE', name: 'Ireland' },
    { code: 'CH', name: 'Switzerland' },
    { code: 'PL', name: 'Poland' },
    { code: 'CZ', name: 'Czech Republic' },
    { code: 'HU', name: 'Hungary' },
];

interface BydSettingsProps {
    onConnectionChange?: (connected: boolean, vin?: string) => void;
}

export const BydSettings: React.FC<BydSettingsProps> = ({ onConnectionChange }) => {
    // Connection state
    const [isConnected, setIsConnected] = useState(false);
    const [connectedVin, setConnectedVin] = useState<string | null>(null);
    const [connectedVehicles, setConnectedVehicles] = useState<BydVehicle[]>([]);

    // Form state
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [countryCode, setCountryCode] = useState('ES');
    const [controlPin, setControlPin] = useState('');

    // UI state
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Diagnostic state
    const [showDiagnostic, setShowDiagnostic] = useState(false);
    const [diagnosticData, setDiagnosticData] = useState<BydDiagnostic | null>(null);
    const [realtimeData, setRealtimeData] = useState<BydRealtime | null>(null);
    const [gpsData, setGpsData] = useState<BydGps | null>(null);

    // Load saved connection on mount
    useEffect(() => {
        const savedVin = localStorage.getItem('byd_connected_vin');
        const savedVehicles = localStorage.getItem('byd_connected_vehicles');

        if (savedVin) {
            setConnectedVin(savedVin);
            setIsConnected(true);
            // Sync with parent (CarContext) if callback provided
            onConnectionChange?.(true, savedVin);
        }
        if (savedVehicles) {
            try {
                setConnectedVehicles(JSON.parse(savedVehicles));
            } catch (e) {
                // Ignore parse errors
            }
        }
    }, []);

    // Handle connect
    const handleConnect = async () => {
        if (!username || !password) {
            setError('Por favor introduce usuario y contraseña');
            return;
        }

        setIsLoading(true);
        setError(null);
        setSuccess(null);

        try {
            // Get Firebase Auth UID for proper Firestore security (optional for dev)
            const userId = await waitForAuth() || 'dev-user';

            const result = await bydConnect(
                username,
                password,
                countryCode,
                controlPin || undefined,
                userId
            );

            if (result.success && result.vehicles.length > 0) {
                const vin = result.vehicles[0].vin;

                setConnectedVin(vin);
                setConnectedVehicles(result.vehicles);
                setIsConnected(true);

                // Save to localStorage
                localStorage.setItem('byd_connected_vin', vin);
                localStorage.setItem('byd_connected_vehicles', JSON.stringify(result.vehicles));

                setSuccess(`Conectado: ${result.vehicles.map(v => v.name || v.model).join(', ')}`);

                // Clear form
                setPassword('');
                setControlPin('');

                onConnectionChange?.(true, vin);
            } else {
                setError('No se encontraron vehículos en la cuenta');
            }
        } catch (err: any) {
            console.error('BYD connect error:', err);
            setError(err.message || 'Error al conectar con BYD');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle disconnect
    const handleDisconnect = async () => {
        if (!connectedVin) return;

        setIsLoading(true);
        setError(null);

        try {
            await bydDisconnect(connectedVin);

            setConnectedVin(null);
            setConnectedVehicles([]);
            setIsConnected(false);
            setDiagnosticData(null);
            setRealtimeData(null);
            setGpsData(null);

            localStorage.removeItem('byd_connected_vin');
            localStorage.removeItem('byd_connected_vehicles');

            setSuccess('Desconectado correctamente');
            onConnectionChange?.(false);
        } catch (err: any) {
            console.error('BYD disconnect error:', err);
            setError(err.message || 'Error al desconectar');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle diagnostic
    const handleDiagnostic = async () => {
        if (!connectedVin) return;

        setIsLoading(true);
        setError(null);
        setDiagnosticData(null);

        try {
            const result = await bydDiagnostic(connectedVin);
            setDiagnosticData(result);
            setShowDiagnostic(true);
        } catch (err: any) {
            console.error('BYD diagnostic error:', err);
            setError(err.message || 'Error en diagnóstico');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle realtime fetch
    const handleGetRealtime = async () => {
        if (!connectedVin) return;

        setIsLoading(true);
        setError(null);

        try {
            const result = await bydGetRealtime(connectedVin);
            if (result.success) {
                setRealtimeData(result.data);
                setSuccess('Datos actualizados');
            }
        } catch (err: any) {
            console.error('BYD realtime error:', err);
            setError(err.message || 'Error al obtener datos');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle GPS fetch
    const handleGetGps = async () => {
        if (!connectedVin) return;

        setIsLoading(true);
        setError(null);

        try {
            const result = await bydGetGps(connectedVin);
            if (result.success) {
                setGpsData(result.data);
                setSuccess('GPS actualizado');
            }
        } catch (err: any) {
            console.error('BYD GPS error:', err);
            setError(err.message || 'Error al obtener GPS');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="byd-settings">
            <div className="settings-section">
                <h3 className="settings-title">
                    <span className="icon">🚗</span>
                    BYD Direct API
                    <span className="badge beta">BETA</span>
                </h3>

                <p className="settings-description">
                    Integración con la API de BYD basada en{' '}
                    <a href="https://github.com/trihoangvo/pybyd" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">pyBYD</a>
                    {' '}y{' '}
                    <a href="https://github.com/LukeEff/byd-re" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">BYD-Re</a>
                    {' '}- proyectos open source de ingeniería inversa.
                </p>

                {/* Status */}
                {isConnected && connectedVin && (
                    <div className="connection-status connected">
                        <span className="status-icon">✓</span>
                        <div className="status-info">
                            <strong>Conectado</strong>
                            <span className="vin">{connectedVin}</span>
                            {connectedVehicles.length > 0 && (
                                <span className="vehicle-name">
                                    {connectedVehicles[0].name || connectedVehicles[0].model}
                                </span>
                            )}
                        </div>
                        <button
                            className="btn-disconnect"
                            onClick={handleDisconnect}
                            disabled={isLoading}
                        >
                            Desconectar
                        </button>
                    </div>
                )}

                {/* Error/Success messages */}
                {error && (
                    <div className="message error">
                        <span className="icon">⚠️</span>
                        {error}
                    </div>
                )}
                {success && (
                    <div className="message success">
                        <span className="icon">✓</span>
                        {success}
                    </div>
                )}

                {/* Connection form */}
                {!isConnected && (
                    <div className="connection-form">
                        <div className="form-group">
                            <label htmlFor="byd-username">Email / Usuario BYD</label>
                            <input
                                id="byd-username"
                                type="email"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="tu@email.com"
                                disabled={isLoading}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="byd-password">Contraseña</label>
                            <input
                                id="byd-password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                disabled={isLoading}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="byd-country">País</label>
                            <select
                                id="byd-country"
                                value={countryCode}
                                onChange={(e) => setCountryCode(e.target.value)}
                                disabled={isLoading}
                            >
                                {COUNTRY_CODES.map((c) => (
                                    <option key={c.code} value={c.code}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="byd-pin">PIN de Control (opcional)</label>
                            <input
                                id="byd-pin"
                                type="password"
                                value={controlPin}
                                onChange={(e) => setControlPin(e.target.value)}
                                placeholder="1234"
                                maxLength={6}
                                disabled={isLoading}
                            />
                            <span className="form-hint">
                                Necesario para bloquear/desbloquear y control de clima
                            </span>
                        </div>

                        <button
                            className="btn-connect"
                            onClick={handleConnect}
                            disabled={isLoading || !username || !password}
                        >
                            {isLoading ? 'Conectando...' : 'Conectar con BYD'}
                        </button>
                    </div>
                )}

                {/* Actions when connected */}
                {isConnected && connectedVin && (
                    <div className="connected-actions">
                        <h4>Acciones de prueba</h4>

                        <div className="action-buttons">
                            <button
                                className="btn-action"
                                onClick={handleGetRealtime}
                                disabled={isLoading}
                            >
                                📊 Obtener datos
                            </button>
                            <button
                                className="btn-action"
                                onClick={handleGetGps}
                                disabled={isLoading}
                            >
                                📍 Obtener GPS
                            </button>
                            <button
                                className="btn-action"
                                onClick={handleDiagnostic}
                                disabled={isLoading}
                            >
                                🔍 Diagnóstico completo
                            </button>
                        </div>

                        {/* Realtime data display */}
                        {realtimeData && (
                            <div className="data-display">
                                <h5>Datos del vehículo</h5>
                                <div className="data-grid">
                                    <div className="data-item">
                                        <span className="label">Batería</span>
                                        <span className="value">{realtimeData.soc}%</span>
                                    </div>
                                    <div className="data-item">
                                        <span className="label">Autonomía</span>
                                        <span className="value">{realtimeData.range} km</span>
                                    </div>
                                    <div className="data-item">
                                        <span className="label">Odómetro</span>
                                        <span className="value">{realtimeData.odometer.toLocaleString()} km</span>
                                    </div>
                                    <div className="data-item">
                                        <span className="label">Estado</span>
                                        <span className="value">
                                            {realtimeData.isCharging ? '🔌 Cargando' : ''}
                                            {realtimeData.isLocked ? '🔒' : '🔓'}
                                            {realtimeData.isOnline ? ' 🟢' : ' 🔴'}
                                        </span>
                                    </div>
                                    {realtimeData.exteriorTemp !== undefined && (
                                        <div className="data-item">
                                            <span className="label">Temp. Exterior</span>
                                            <span className="value">{realtimeData.exteriorTemp}°C</span>
                                        </div>
                                    )}
                                    {realtimeData.interiorTemp !== undefined && (
                                        <div className="data-item">
                                            <span className="label">Temp. Interior</span>
                                            <span className="value">{realtimeData.interiorTemp}°C</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* GPS data display */}
                        {gpsData && (
                            <div className="data-display">
                                <h5>Ubicación GPS</h5>
                                <div className="data-grid">
                                    <div className="data-item">
                                        <span className="label">Latitud</span>
                                        <span className="value">{gpsData.latitude.toFixed(6)}</span>
                                    </div>
                                    <div className="data-item">
                                        <span className="label">Longitud</span>
                                        <span className="value">{gpsData.longitude.toFixed(6)}</span>
                                    </div>
                                    {gpsData.heading !== undefined && (
                                        <div className="data-item">
                                            <span className="label">Dirección</span>
                                            <span className="value">{gpsData.heading}°</span>
                                        </div>
                                    )}
                                </div>
                                <a
                                    href={`https://www.google.com/maps?q=${gpsData.latitude},${gpsData.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-map"
                                >
                                    🗺️ Ver en Google Maps
                                </a>
                            </div>
                        )}

                        {/* Full diagnostic display */}
                        {showDiagnostic && diagnosticData && (
                            <div className="diagnostic-display">
                                <h5>
                                    Diagnóstico Completo
                                    <button
                                        className="btn-close"
                                        onClick={() => setShowDiagnostic(false)}
                                    >
                                        ✕
                                    </button>
                                </h5>
                                <pre className="diagnostic-json">
                                    {JSON.stringify(diagnosticData, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <style>{`
                .byd-settings {
                    padding: 1rem;
                }

                .settings-section {
                    background: #ffffff;
                    border-radius: 12px;
                    padding: 1.5rem;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }

                .dark .settings-section {
                    background: #1e293b;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                }

                .settings-title {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin: 0 0 0.5rem 0;
                    font-size: 1.25rem;
                    color: #1f2937;
                }

                .dark .settings-title {
                    color: #f1f5f9;
                }

                .settings-title .icon {
                    font-size: 1.5rem;
                }

                .badge.beta {
                    background: #ff9800;
                    color: white;
                    font-size: 0.6rem;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-weight: bold;
                }

                .settings-description {
                    color: #6b7280;
                    font-size: 0.9rem;
                    margin-bottom: 1.5rem;
                }

                .dark .settings-description {
                    color: #94a3b8;
                }

                .connection-status {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1rem;
                    border-radius: 8px;
                    margin-bottom: 1rem;
                }

                .connection-status.connected {
                    background: #dcfce7;
                    border: 1px solid #4ade80;
                }

                .dark .connection-status.connected {
                    background: rgba(34, 197, 94, 0.15);
                    border: 1px solid #22c55e;
                }

                .status-icon {
                    font-size: 1.5rem;
                    color: #22c55e;
                }

                .status-info {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }

                .status-info strong {
                    color: #166534;
                }

                .dark .status-info strong {
                    color: #4ade80;
                }

                .status-info .vin {
                    font-family: monospace;
                    font-size: 0.8rem;
                    color: #6b7280;
                }

                .dark .status-info .vin {
                    color: #94a3b8;
                }

                .status-info .vehicle-name {
                    font-size: 0.9rem;
                    color: #6b7280;
                }

                .dark .status-info .vehicle-name {
                    color: #94a3b8;
                }

                .message {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1rem;
                    border-radius: 8px;
                    margin-bottom: 1rem;
                    font-size: 0.9rem;
                }

                .message.error {
                    background: #fee2e2;
                    color: #dc2626;
                    border: 1px solid #f87171;
                }

                .dark .message.error {
                    background: rgba(220, 38, 38, 0.15);
                    color: #f87171;
                    border: 1px solid rgba(248, 113, 113, 0.3);
                }

                .message.success {
                    background: #dcfce7;
                    color: #16a34a;
                    border: 1px solid #4ade80;
                }

                .dark .message.success {
                    background: rgba(34, 197, 94, 0.15);
                    color: #4ade80;
                    border: 1px solid rgba(74, 222, 128, 0.3);
                }

                .connection-form {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }

                .form-group label {
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: #374151;
                }

                .dark .form-group label {
                    color: #e2e8f0;
                }

                .form-group input,
                .form-group select {
                    padding: 0.75rem;
                    border: 1px solid #d1d5db;
                    border-radius: 8px;
                    font-size: 1rem;
                    background: #ffffff;
                    color: #1f2937;
                }

                .dark .form-group input,
                .dark .form-group select {
                    background: #0f172a;
                    border-color: #334155;
                    color: #f1f5f9;
                }

                .form-group input:focus,
                .form-group select:focus {
                    outline: none;
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
                }

                .form-group input::placeholder {
                    color: #9ca3af;
                }

                .dark .form-group input::placeholder {
                    color: #64748b;
                }

                .form-hint {
                    font-size: 0.75rem;
                    color: #6b7280;
                }

                .dark .form-hint {
                    color: #94a3b8;
                }

                .btn-connect,
                .btn-disconnect {
                    padding: 0.75rem 1.5rem;
                    border: none;
                    border-radius: 8px;
                    font-size: 1rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .btn-connect {
                    background: #3b82f6;
                    color: white;
                }

                .btn-connect:hover:not(:disabled) {
                    background: #2563eb;
                }

                .btn-connect:disabled {
                    background: #9ca3af;
                    cursor: not-allowed;
                }

                .dark .btn-connect:disabled {
                    background: #475569;
                }

                .btn-disconnect {
                    background: #ef4444;
                    color: white;
                }

                .btn-disconnect:hover:not(:disabled) {
                    background: #dc2626;
                }

                .connected-actions {
                    margin-top: 1.5rem;
                }

                .connected-actions h4 {
                    margin: 0 0 1rem 0;
                    font-size: 1rem;
                    color: #374151;
                }

                .dark .connected-actions h4 {
                    color: #e2e8f0;
                }

                .action-buttons {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    margin-bottom: 1rem;
                }

                .btn-action {
                    padding: 0.5rem 1rem;
                    background: #f3f4f6;
                    border: 1px solid #d1d5db;
                    border-radius: 8px;
                    font-size: 0.9rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    color: #374151;
                }

                .dark .btn-action {
                    background: #334155;
                    border-color: #475569;
                    color: #e2e8f0;
                }

                .btn-action:hover:not(:disabled) {
                    background: #e5e7eb;
                }

                .dark .btn-action:hover:not(:disabled) {
                    background: #475569;
                }

                .btn-action:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .data-display {
                    background: #f9fafb;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 1rem;
                    margin-bottom: 1rem;
                }

                .dark .data-display {
                    background: #0f172a;
                    border-color: #334155;
                }

                .data-display h5 {
                    margin: 0 0 0.75rem 0;
                    font-size: 0.9rem;
                    color: #6b7280;
                }

                .dark .data-display h5 {
                    color: #94a3b8;
                }

                .data-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                    gap: 0.75rem;
                }

                .data-item {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }

                .data-item .label {
                    font-size: 0.75rem;
                    color: #6b7280;
                }

                .dark .data-item .label {
                    color: #94a3b8;
                }

                .data-item .value {
                    font-size: 1rem;
                    font-weight: 500;
                    color: #1f2937;
                }

                .dark .data-item .value {
                    color: #f1f5f9;
                }

                .btn-map {
                    display: inline-block;
                    margin-top: 0.75rem;
                    padding: 0.5rem 1rem;
                    background: #3b82f6;
                    color: white;
                    text-decoration: none;
                    border-radius: 8px;
                    font-size: 0.9rem;
                }

                .btn-map:hover {
                    background: #2563eb;
                }

                .diagnostic-display {
                    margin-top: 1rem;
                }

                .diagnostic-display h5 {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin: 0 0 0.5rem 0;
                    color: #374151;
                }

                .dark .diagnostic-display h5 {
                    color: #e2e8f0;
                }

                .btn-close {
                    background: none;
                    border: none;
                    font-size: 1.25rem;
                    cursor: pointer;
                    color: #6b7280;
                }

                .dark .btn-close {
                    color: #94a3b8;
                }

                .btn-close:hover {
                    color: #374151;
                }

                .dark .btn-close:hover {
                    color: #e2e8f0;
                }

                .diagnostic-json {
                    background: #1e293b;
                    color: #a3e635;
                    padding: 1rem;
                    border-radius: 8px;
                    font-size: 0.75rem;
                    overflow-x: auto;
                    max-height: 400px;
                }
            `}</style>
        </div>
    );
};

export default BydSettings;
