/**
 * BYD Direct API Settings Component
 * Connect and manage BYD account
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    bydConnect,
    bydDisconnect,
    BydVehicle,
    bydDebugDump,
    bydSaveAbrpToken,
} from '../../services/bydApi';
import { waitForAuth, db } from '../../services/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

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
    const { t } = useTranslation();

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

    // Auto-register charges setting
    const [autoRegisterCharges, setAutoRegisterCharges] = useState(() => {
        const saved = localStorage.getItem('byd_auto_register_charges');
        return saved === 'true';
    });

    // Location watch (heartbeat) setting
    const [heartbeatEnabled, setHeartbeatEnabled] = useState(false);

    // ABRP token setting
    const [abrpToken, setAbrpToken] = useState('');
    const [abrpSaving, setAbrpSaving] = useState(false);

    // Diagnostic state (API Dump easter egg)
    const [debugDump, setDebugDump] = useState<any | null>(null);

    // Easter egg state: 10 taps in 2 seconds
    const [tapCount, setTapCount] = useState(0);
    const [tapTimeout, setTapTimeout] = useState<NodeJS.Timeout | null>(null);

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

    // Load heartbeatEnabled and abrpToken from Firestore when connected
    useEffect(() => {
        if (!connectedVin) return;
        getDoc(doc(db, 'bydVehicles', connectedVin)).then((snap) => {
            if (snap.exists()) {
                setHeartbeatEnabled(snap.data().heartbeatEnabled === true);
                setAbrpToken(snap.data().abrpUserToken || '');
            }
        }).catch(() => { });
    }, [connectedVin]);

    const handleSaveAbrpToken = async () => {
        if (!connectedVin) return;
        setAbrpSaving(true);
        try {
            await bydSaveAbrpToken(connectedVin, abrpToken.trim());
            toast.success(abrpToken.trim() ? 'Token ABRP guardado' : 'Token ABRP eliminado');
        } catch (err: unknown) {
            console.error('Error saving ABRP token:', err);
            toast.error('Error al guardar el token');
        } finally {
            setAbrpSaving(false);
        }
    };

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
        } catch (err: unknown) {
            console.error('BYD connect error:', err);
            setError(err instanceof Error ? err.message : 'Error al conectar con BYD');
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
            setDebugDump(null);

            localStorage.removeItem('byd_connected_vin');
            localStorage.removeItem('byd_connected_vehicles');
            localStorage.removeItem('byd_auto_register_charges');

            setSuccess('Desconectado correctamente');
            onConnectionChange?.(false);
        } catch (err: unknown) {
            console.error('BYD disconnect error:', err);
            setError(err instanceof Error ? err.message : 'Error al desconectar');
        } finally {
            setIsLoading(false);
        }
    };

    // Easter egg: 10 taps in 2 seconds to show API Dump
    const handleConnectionTap = () => {
        const newCount = tapCount + 1;
        setTapCount(newCount);

        // Clear existing timeout
        if (tapTimeout) {
            clearTimeout(tapTimeout);
        }

        // Reset after 2 seconds
        const timeout = setTimeout(() => {
            setTapCount(0);
        }, 2000);
        setTapTimeout(timeout);

        // Trigger API Dump after 10 taps
        if (newCount >= 10) {
            setTapCount(0);
            clearTimeout(timeout);
            handleDebugDump();
        }
    };

    // Handle debug dump (easter egg)
    const handleDebugDump = async () => {
        if (!connectedVin) return;

        setIsLoading(true);
        setError(null);
        setDebugDump(null);

        try {
            const result = await bydDebugDump(connectedVin);
            if (result.success) {
                setDebugDump(result.dump);
                toast.success('API Dump obtenido correctamente');
            } else {
                setError('Error al obtener dump');
            }
        } catch (err: unknown) {
            console.error('BYD dump error:', err);
            setError(err instanceof Error ? err.message : 'Error al obtener dump');
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
                    <div className="mb-4">
                        <div
                            className="connection-status connected"
                            style={{ marginBottom: '1rem', cursor: 'pointer', userSelect: 'none' }}
                            onClick={handleConnectionTap}
                            title="Toca 10 veces para API Dump"
                        >
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
                        </div>
                        <button
                            className="btn-disconnect w-full"
                            onClick={handleDisconnect}
                            disabled={isLoading}
                        >
                            Desconectar
                        </button>

                        {/* Auto-register charges toggle */}
                        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                            <label className="flex items-center justify-between cursor-pointer select-none">
                                <div>
                                    <div className="font-medium text-slate-700 dark:text-slate-200 mb-1">
                                        {t('charges.autoRegisterTitle')}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        {t('charges.autoRegisterDesc')}
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={autoRegisterCharges}
                                    onChange={(e) => {
                                        const newValue = e.target.checked;
                                        setAutoRegisterCharges(newValue);
                                        localStorage.setItem('byd_auto_register_charges', String(newValue));
                                        toast.success(newValue ? t('charges.autoRegisterEnabled') : t('charges.autoRegisterDisabled'));
                                    }}
                                    className="toggle-checkbox w-11 h-6 cursor-pointer"
                                />
                            </label>
                        </div>

                        {/* Location watch (heartbeat) toggle */}
                        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                            <label className="flex items-center justify-between cursor-pointer select-none">
                                <div>
                                    <div className="font-medium text-slate-700 dark:text-slate-200 mb-1">
                                        {t('charges.locationWatchTitle')}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        {t('charges.locationWatchDesc')}
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={heartbeatEnabled}
                                    onChange={async (e) => {
                                        const newValue = e.target.checked;
                                        setHeartbeatEnabled(newValue);
                                        if (connectedVin) {
                                            try {
                                                await updateDoc(doc(db, 'bydVehicles', connectedVin), {
                                                    heartbeatEnabled: newValue,
                                                });
                                            } catch (err) {
                                                console.error('Error updating heartbeatEnabled:', err);
                                                setHeartbeatEnabled(!newValue);
                                                return;
                                            }
                                        }
                                        toast.success(newValue ? t('charges.locationWatchEnabled') : t('charges.locationWatchDisabled'));
                                    }}
                                    className="toggle-checkbox w-11 h-6 cursor-pointer"
                                />
                            </label>
                        </div>

                        {/* ABRP Integration */}
                        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="font-medium text-slate-700 dark:text-slate-200 mb-1">
                                ABRP — A Better Route Planner
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                                Introduce tu token de ABRP para enviar telemetría en tiempo real.
                                Encuéntralo en ABRP → Perfil → «Link car».
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="password"
                                    value={abrpToken}
                                    onChange={(e) => setAbrpToken(e.target.value)}
                                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                    className="flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                                />
                                <button
                                    onClick={handleSaveAbrpToken}
                                    disabled={abrpSaving}
                                    className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
                                >
                                    {abrpSaving ? '...' : 'Guardar'}
                                </button>
                            </div>
                            {abrpToken && (
                                <div className="mt-2 text-xs text-green-600 dark:text-green-400">
                                    ✓ Telemetría ABRP activa
                                </div>
                            )}
                        </div>
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

                {/* API Dump Display (Easter Egg: 10 taps on connected status) */}
                {isConnected && connectedVin && debugDump && (
                    <div className="diagnostic-display" style={{ marginTop: '1rem' }}>
                        <h5>
                            API Dump (Raw)
                            <div className="dump-actions">
                                <button
                                    className="btn-copy"
                                    onClick={() => {
                                        navigator.clipboard.writeText(JSON.stringify(debugDump, null, 2));
                                        toast.success('Dump copiado al portapapeles');
                                    }}
                                >
                                    📋 Copiar
                                </button>
                                <button
                                    className="btn-close"
                                    onClick={() => setDebugDump(null)}
                                >
                                    ✕
                                </button>
                            </div>
                        </h5>
                        <div className="dump-info">
                            <small>Guardado en Firestore: <code>bydVehicles/{connectedVin}/debug</code></small>
                        </div>
                        <pre className="diagnostic-json">
                            {JSON.stringify(debugDump, null, 2)}
                        </pre>
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
                    min-width: 0;
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
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
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
                    flex-shrink: 0;
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
