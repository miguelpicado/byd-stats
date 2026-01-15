# Planificación: Registro de Cargas - BYD Stats

## Índice
1. [Descripción General](#descripción-general)
2. [Requisitos Funcionales](#requisitos-funcionales)
3. [Arquitectura de la Solución](#arquitectura-de-la-solución)
4. [Fases de Implementación](#fases-de-implementación)
5. [Órdenes para el LLM](#órdenes-para-el-llm)

---

## Descripción General

Esta funcionalidad añade un sistema completo de registro de cargas al vehículo eléctrico, permitiendo al usuario:
- Registrar manualmente cada carga realizada
- Visualizar el histórico de cargas
- Configurar diferentes tipos de cargadores con sus eficiencias
- Calcular los kWh reales que entran en la batería

---

## Requisitos Funcionales

### RF1: Nueva Tab "Registro de Cargas"
- Mostrar histórico completo de cargas realizadas
- Vista inicial: fecha, hora, kW cargados
- Ordenación por fecha descendente (más recientes primero)

### RF2: Botón Flotante "+"
- Posición: esquina inferior derecha
- No debe superponerse con la barra de tabs en modo vertical
- Al pulsar: abre modal de nueva carga

### RF3: Modal de Nueva Carga
Campos a introducir:
| Campo | Tipo | Obligatorio |
|-------|------|-------------|
| Cuentakilómetros | number | Sí |
| kWh recargados | number | Sí |
| Tipo de cargador | select | Sí |
| Precio/kWh | number | Sí |
| Coste total | number | Sí (auto-calculable) |
| Fecha | date | Sí |
| Hora | time | Sí |
| % final de carga | number | Sí |
| % inicial de carga | number | No |

### RF4: Modal de Detalles de Carga
- Mostrar todos los campos de la carga
- Calcular y mostrar kWh reales = kWh cargados × eficiencia
- Opciones: Editar, Eliminar

### RF5: Configuración de Tipos de Cargadores
Tipos predefinidos:
| Tipo | Velocidad (kW) | Eficiencia |
|------|----------------|------------|
| 240V (Doméstico) | 2.4 | 85% |
| Carga lenta | 7.4 | 90% |
| Carga rápida | 50 | 92% |
| Carga ultrarrápida | 150 | 95% |

El usuario podrá editar estos valores y añadir nuevos tipos.

---

## Arquitectura de la Solución

### Estructura de Datos

```javascript
// Esquema de una carga
const chargeSchema = {
    id: 'string (uuid)',           // Identificador único
    date: 'string (YYYYMMDD)',     // Fecha formato interno
    time: 'string (HH:MM)',        // Hora
    timestamp: 'number',           // Unix timestamp para ordenación
    odometer: 'number',            // Cuentakilómetros en km
    kwhCharged: 'number',          // kWh recargados
    chargerTypeId: 'string',       // ID del tipo de cargador
    pricePerKwh: 'number',         // Precio por kWh en €
    totalCost: 'number',           // Coste total en €
    finalPercentage: 'number',     // % final (0-100)
    initialPercentage: 'number|null' // % inicial (opcional)
};

// Esquema de tipo de cargador (en settings)
const chargerTypeSchema = {
    id: 'string',                  // Identificador único
    name: 'string',                // Nombre mostrado
    speedKw: 'number',             // Velocidad en kW
    efficiency: 'number'           // Eficiencia (0-1)
};
```

### Persistencia
- **Clave localStorage**: `byd_charges_data`
- **Formato**: Array JSON de objetos charge

### Nuevos Archivos

```
src/
├── components/
│   ├── tabs/
│   │   └── ChargesTab.jsx          # Nueva tab
│   ├── modals/
│   │   ├── AddChargeModal.jsx      # Modal añadir carga
│   │   └── ChargeDetailModal.jsx   # Modal detalles
│   ├── cards/
│   │   └── ChargeCard.jsx          # Tarjeta de carga
│   └── common/
│       └── FloatingActionButton.jsx # Botón flotante
├── hooks/
│   └── useChargesData.js           # Hook gestión datos
```

### Archivos a Modificar

```
src/
├── App.jsx                         # Registrar tab + lazy load
├── context/
│   └── AppContext.jsx              # Añadir chargerTypes
├── hooks/
│   └── useModalState.js            # Nuevos modales
├── components/
│   ├── modals/
│   │   └── SettingsModal.jsx       # Sección cargadores
│   └── common/
│       └── ModalContainer.jsx      # Incluir modales
├── constants/
│   └── layout.js                   # Nueva constante storage
public/
└── locales/
    ├── es.json                     # Traducciones español
    ├── en.json                     # Traducciones inglés
    ├── ca.json                     # Traducciones catalán
    ├── gl.json                     # Traducciones gallego
    ├── eu.json                     # Traducciones euskera
    └── pt.json                     # Traducciones portugués
```

---

## Fases de Implementación

### FASE 1: Estructura de Datos y Persistencia

**Objetivo**: Establecer la base de datos y el hook de gestión.

**Archivos a modificar/crear**:

#### 1.1 `src/constants/layout.js`
Añadir al final:
```javascript
export const CHARGES_STORAGE_KEY = 'byd_charges_data';
```

#### 1.2 Crear `src/hooks/useChargesData.js`
```javascript
import { useState, useCallback, useEffect } from 'react';
import { CHARGES_STORAGE_KEY } from '../constants/layout';

const useChargesData = () => {
    const [charges, setCharges] = useState(() => {
        try {
            const saved = localStorage.getItem(CHARGES_STORAGE_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    // Persistir cambios
    useEffect(() => {
        localStorage.setItem(CHARGES_STORAGE_KEY, JSON.stringify(charges));
    }, [charges]);

    // Añadir carga
    const addCharge = useCallback((charge) => {
        const newCharge = {
            ...charge,
            id: crypto.randomUUID(),
            timestamp: new Date(`${charge.date}T${charge.time}`).getTime()
        };
        setCharges(prev => [newCharge, ...prev].sort((a, b) => b.timestamp - a.timestamp));
        return newCharge;
    }, []);

    // Actualizar carga
    const updateCharge = useCallback((id, updates) => {
        setCharges(prev => prev.map(c =>
            c.id === id ? { ...c, ...updates } : c
        ));
    }, []);

    // Eliminar carga
    const deleteCharge = useCallback((id) => {
        setCharges(prev => prev.filter(c => c.id !== id));
    }, []);

    // Obtener carga por ID
    const getChargeById = useCallback((id) => {
        return charges.find(c => c.id === id);
    }, [charges]);

    return {
        charges,
        addCharge,
        updateCharge,
        deleteCharge,
        getChargeById
    };
};

export default useChargesData;
```

**Verificación**:
- [ ] Importar hook en un componente temporal y verificar que carga/guarda
- [ ] Verificar en DevTools > Application > Local Storage que se guarda correctamente

---

### FASE 2: Configuración de Tipos de Cargadores

**Objetivo**: Permitir configurar tipos de cargadores desde Settings.

#### 2.1 `src/context/AppContext.jsx`

Modificar `DEFAULT_SETTINGS`:
```javascript
const DEFAULT_SETTINGS = {
    carModel: '',
    licensePlate: '',
    insurancePolicy: '',
    batterySize: 60.48,
    soh: 100,
    electricityPrice: 0.15,
    theme: 'auto',
    // NUEVO
    chargerTypes: [
        { id: 'domestic', name: '240V (Doméstico)', speedKw: 2.4, efficiency: 0.85 },
        { id: 'slow', name: 'Carga lenta', speedKw: 7.4, efficiency: 0.90 },
        { id: 'fast', name: 'Carga rápida', speedKw: 50, efficiency: 0.92 },
        { id: 'ultrafast', name: 'Carga ultrarrápida', speedKw: 150, efficiency: 0.95 }
    ]
};
```

Modificar la función `updateSettings` para incluir `chargerTypes` en la validación:
```javascript
const validated = {
    // ... campos existentes ...
    chargerTypes: updated.chargerTypes ?? prev.chargerTypes ?? DEFAULT_SETTINGS.chargerTypes
};
```

#### 2.2 `src/components/modals/SettingsModal.jsx`

Añadir nueva sección después de la sección de precio de electricidad:
```jsx
{/* Tipos de Cargadores */}
<div className="space-y-3">
    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
        <Zap className="w-4 h-4" style={{ color: BYD_RED }} />
        {t('settings.chargerTypes')}
    </h3>

    {settings.chargerTypes.map((charger, index) => (
        <div key={charger.id} className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-3 space-y-2">
            <input
                type="text"
                value={charger.name}
                onChange={(e) => handleChargerTypeChange(index, 'name', e.target.value)}
                className="w-full bg-white dark:bg-slate-700 rounded-lg px-3 py-2 text-sm"
                placeholder={t('settings.chargerName')}
            />
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-xs text-slate-500">{t('settings.chargerSpeed')}</label>
                    <input
                        type="number"
                        step="0.1"
                        value={charger.speedKw}
                        onChange={(e) => handleChargerTypeChange(index, 'speedKw', parseFloat(e.target.value))}
                        className="w-full bg-white dark:bg-slate-700 rounded-lg px-3 py-2 text-sm"
                    />
                </div>
                <div>
                    <label className="text-xs text-slate-500">{t('settings.chargerEfficiency')}</label>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        value={charger.efficiency}
                        onChange={(e) => handleChargerTypeChange(index, 'efficiency', parseFloat(e.target.value))}
                        className="w-full bg-white dark:bg-slate-700 rounded-lg px-3 py-2 text-sm"
                    />
                </div>
            </div>
            <button
                onClick={() => handleDeleteChargerType(index)}
                className="text-xs text-red-500 hover:text-red-700"
            >
                {t('settings.deleteChargerType')}
            </button>
        </div>
    ))}

    <button
        onClick={handleAddChargerType}
        className="w-full py-2 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:border-slate-400 hover:text-slate-600"
    >
        + {t('settings.addChargerType')}
    </button>
</div>
```

#### 2.3 Traducciones `public/locales/es.json`

Añadir en la sección "settings":
```json
"chargerTypes": "Tipos de cargadores",
"chargerName": "Nombre",
"chargerSpeed": "Velocidad (kW)",
"chargerEfficiency": "Eficiencia (0-1)",
"addChargerType": "Añadir tipo",
"deleteChargerType": "Eliminar"
```

**Verificación**:
- [ ] Los tipos de cargadores aparecen en Settings
- [ ] Se pueden editar nombre, velocidad y eficiencia
- [ ] Se pueden añadir y eliminar tipos
- [ ] Los cambios persisten al recargar la app

---

### FASE 3: Nueva Tab Básica

**Objetivo**: Crear la estructura de la tab sin funcionalidad completa.

#### 3.1 Crear `src/components/tabs/ChargesTab.jsx`

```jsx
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useLayout } from '../../context/LayoutContext';
import { Battery, BYD_RED } from '../Icons.jsx';

const ChargesTab = React.memo(({ charges, onChargeClick, onAddClick }) => {
    const { t } = useTranslation();
    const { isCompact, isVertical } = useLayout();

    const sortedCharges = useMemo(() => {
        return [...charges].sort((a, b) => b.timestamp - a.timestamp);
    }, [charges]);

    if (charges.length === 0) {
        return (
            <div className={`flex flex-col items-center justify-center h-full ${isCompact ? 'py-8' : 'py-16'}`}>
                <Battery className="w-16 h-16 text-slate-300 dark:text-slate-600 mb-4" />
                <p className="text-slate-500 dark:text-slate-400 text-center">
                    {t('charges.noCharges')}
                </p>
                <p className="text-slate-400 dark:text-slate-500 text-sm text-center mt-1">
                    {t('charges.addFirst')}
                </p>
            </div>
        );
    }

    return (
        <div className={`space-y-3 ${isCompact ? 'space-y-2' : ''}`}>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Battery className="w-5 h-5" style={{ color: BYD_RED }} />
                {t('charges.title')}
            </h2>

            <div className={`space-y-2 ${isCompact ? 'space-y-1' : ''}`}>
                {sortedCharges.map(charge => (
                    <div
                        key={charge.id}
                        onClick={() => onChargeClick(charge)}
                        className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {charge.date} - {charge.time}
                                </p>
                                <p className="text-lg font-bold text-slate-900 dark:text-white">
                                    {charge.kwhCharged.toFixed(2)} kWh
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-amber-600 dark:text-amber-400 font-semibold">
                                    {charge.totalCost.toFixed(2)} €
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
});

ChargesTab.propTypes = {
    charges: PropTypes.array.isRequired,
    onChargeClick: PropTypes.func.isRequired,
    onAddClick: PropTypes.func
};

ChargesTab.displayName = 'ChargesTab';

export default ChargesTab;
```

#### 3.2 Modificar `src/App.jsx`

**Importar** (junto a los otros lazy imports):
```javascript
const ChargesTab = lazy(() => import('./components/tabs/ChargesTab'));
```

**Añadir al array de tabs** (buscar `const tabs = useMemo`):
```javascript
{ id: 'charges', label: t('tabs.charges'), icon: Battery }
```

**Añadir render en modo vertical** (buscar el bloque de tabs en modo vertical):
```jsx
<div style={{ width: `${100 / tabs.length}%`, flexShrink: 0 }}>
    <div className={getTabClassName('charges', activeTab, fadingTab)}>
        <Suspense fallback={<LoadingSpinner />}>
            {(activeTab === 'charges' || backgroundLoad) && (
                <ChargesTab
                    charges={charges}
                    onChargeClick={handleChargeClick}
                    onAddClick={() => openModal('addCharge')}
                />
            )}
        </Suspense>
    </div>
</div>
```

**Añadir render en modo horizontal** (similar estructura).

#### 3.3 Traducciones `public/locales/es.json`

Añadir en "tabs":
```json
"charges": "Cargas"
```

Añadir nueva sección:
```json
"charges": {
    "title": "Registro de Cargas",
    "noCharges": "No hay cargas registradas",
    "addFirst": "Pulsa + para añadir tu primera carga"
}
```

**Verificación**:
- [ ] La tab "Cargas" aparece en la navegación
- [ ] Se puede navegar a la tab (swipe en vertical, click en horizontal)
- [ ] Muestra estado vacío correctamente
- [ ] No rompe las demás tabs

---

### FASE 4: Modal de Nueva Carga y Botón Flotante

**Objetivo**: Implementar la entrada de datos de nuevas cargas.

#### 4.1 Crear `src/components/common/FloatingActionButton.jsx`

```jsx
import React from 'react';
import PropTypes from 'prop-types';
import { Plus } from '../Icons.jsx';
import { BYD_RED } from '../../utils/constants';

const FloatingActionButton = ({ onClick, icon: Icon = Plus, label }) => {
    return (
        <button
            onClick={onClick}
            aria-label={label}
            className="fixed z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-transform hover:scale-110 active:scale-95"
            style={{
                backgroundColor: BYD_RED,
                right: '1rem',
                bottom: 'calc(5rem + env(safe-area-inset-bottom))'
            }}
        >
            <Icon className="w-6 h-6" />
        </button>
    );
};

FloatingActionButton.propTypes = {
    onClick: PropTypes.func.isRequired,
    icon: PropTypes.elementType,
    label: PropTypes.string
};

export default FloatingActionButton;
```

#### 4.2 Crear `src/components/modals/AddChargeModal.jsx`

```jsx
import React, { useState, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Battery, BYD_RED } from '../Icons.jsx';
import ModalHeader from '../common/ModalHeader';

const AddChargeModal = ({
    isOpen,
    onClose,
    onSave,
    chargerTypes,
    defaultPricePerKwh,
    editingCharge = null
}) => {
    const { t } = useTranslation();

    const initialState = {
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0, 5),
        odometer: '',
        kwhCharged: '',
        chargerTypeId: chargerTypes[0]?.id || '',
        pricePerKwh: defaultPricePerKwh || 0.15,
        totalCost: '',
        finalPercentage: '',
        initialPercentage: ''
    };

    const [formData, setFormData] = useState(initialState);

    useEffect(() => {
        if (editingCharge) {
            setFormData(editingCharge);
        } else {
            setFormData(initialState);
        }
    }, [editingCharge, isOpen]);

    // Auto-calcular coste total
    useEffect(() => {
        if (formData.kwhCharged && formData.pricePerKwh) {
            const cost = parseFloat(formData.kwhCharged) * parseFloat(formData.pricePerKwh);
            setFormData(prev => ({ ...prev, totalCost: cost.toFixed(2) }));
        }
    }, [formData.kwhCharged, formData.pricePerKwh]);

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = () => {
        // Validación básica
        if (!formData.kwhCharged || !formData.odometer || !formData.finalPercentage) {
            alert(t('charges.fillRequired'));
            return;
        }

        const chargeData = {
            ...formData,
            odometer: parseFloat(formData.odometer),
            kwhCharged: parseFloat(formData.kwhCharged),
            pricePerKwh: parseFloat(formData.pricePerKwh),
            totalCost: parseFloat(formData.totalCost),
            finalPercentage: parseFloat(formData.finalPercentage),
            initialPercentage: formData.initialPercentage ? parseFloat(formData.initialPercentage) : null
        };

        onSave(chargeData);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>

            <div
                role="dialog"
                aria-modal="true"
                className="relative bg-white dark:bg-slate-800 rounded-2xl p-5 max-w-md w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700"
                onClick={(e) => e.stopPropagation()}
            >
                <ModalHeader
                    title={editingCharge ? t('charges.editCharge') : t('charges.addCharge')}
                    Icon={Battery}
                    onClose={onClose}
                    iconColor={BYD_RED}
                />

                <div className="space-y-4">
                    {/* Fecha y Hora */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                                {t('charges.date')}
                            </label>
                            <input
                                type="date"
                                value={formData.date}
                                onChange={(e) => handleChange('date', e.target.value)}
                                className="w-full bg-slate-100 dark:bg-slate-700/50 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-600"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                                {t('charges.time')}
                            </label>
                            <input
                                type="time"
                                value={formData.time}
                                onChange={(e) => handleChange('time', e.target.value)}
                                className="w-full bg-slate-100 dark:bg-slate-700/50 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-600"
                            />
                        </div>
                    </div>

                    {/* Cuentakilómetros */}
                    <div>
                        <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                            {t('charges.odometer')} (km)
                        </label>
                        <input
                            type="number"
                            value={formData.odometer}
                            onChange={(e) => handleChange('odometer', e.target.value)}
                            placeholder="12345"
                            className="w-full bg-slate-100 dark:bg-slate-700/50 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-600"
                        />
                    </div>

                    {/* kWh y Tipo de cargador */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                                {t('charges.kwhCharged')}
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.kwhCharged}
                                onChange={(e) => handleChange('kwhCharged', e.target.value)}
                                placeholder="45.5"
                                className="w-full bg-slate-100 dark:bg-slate-700/50 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-600"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                                {t('charges.chargerType')}
                            </label>
                            <select
                                value={formData.chargerTypeId}
                                onChange={(e) => handleChange('chargerTypeId', e.target.value)}
                                className="w-full bg-slate-100 dark:bg-slate-700/50 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-600"
                            >
                                {chargerTypes.map(ct => (
                                    <option key={ct.id} value={ct.id}>{ct.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Precio y Coste */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                                {t('charges.pricePerKwh')} (€)
                            </label>
                            <input
                                type="number"
                                step="0.001"
                                value={formData.pricePerKwh}
                                onChange={(e) => handleChange('pricePerKwh', e.target.value)}
                                className="w-full bg-slate-100 dark:bg-slate-700/50 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-600"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                                {t('charges.totalCost')} (€)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.totalCost}
                                onChange={(e) => handleChange('totalCost', e.target.value)}
                                className="w-full bg-slate-100 dark:bg-slate-700/50 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-600"
                            />
                        </div>
                    </div>

                    {/* Porcentajes */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                                {t('charges.finalPercentage')} (%)
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={formData.finalPercentage}
                                onChange={(e) => handleChange('finalPercentage', e.target.value)}
                                placeholder="80"
                                className="w-full bg-slate-100 dark:bg-slate-700/50 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-600"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                                {t('charges.initialPercentage')} (%)
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={formData.initialPercentage}
                                onChange={(e) => handleChange('initialPercentage', e.target.value)}
                                placeholder={t('charges.optional')}
                                className="w-full bg-slate-100 dark:bg-slate-700/50 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-600"
                            />
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleSubmit}
                    className="w-full mt-6 py-3 rounded-xl font-medium text-white"
                    style={{ backgroundColor: BYD_RED }}
                >
                    {t('charges.save')}
                </button>
            </div>
        </div>
    );
};

AddChargeModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired,
    chargerTypes: PropTypes.array.isRequired,
    defaultPricePerKwh: PropTypes.number,
    editingCharge: PropTypes.object
};

export default AddChargeModal;
```

#### 4.3 Modificar `src/hooks/useModalState.js`

Añadir en el objeto inicial de modals:
```javascript
addCharge: false,
chargeDetail: false
```

Añadir también en `closeAllModals`.

#### 4.4 Modificar `src/components/common/ModalContainer.jsx`

Añadir lazy import y render del modal.

#### 4.5 Integrar en ChargesTab

Añadir el FloatingActionButton al final del componente.

**Verificación**:
- [ ] Botón "+" visible y bien posicionado
- [ ] Modal se abre al pulsar "+"
- [ ] Todos los campos funcionan
- [ ] Coste se auto-calcula
- [ ] La carga se guarda correctamente

---

### FASE 5: Lista de Cargas y Modal de Detalles

**Objetivo**: Completar la visualización y edición de cargas.

#### 5.1 Crear `src/components/modals/ChargeDetailModal.jsx`

Modal que muestra todos los detalles de una carga incluyendo el cálculo de kWh reales.

#### 5.2 Completar ChargesTab

Añadir resumen de estadísticas y mejorar la visualización de la lista.

#### 5.3 Integrar funcionalidad de editar/eliminar

Conectar los botones del modal de detalles con las funciones del hook.

**Verificación**:
- [ ] Click en carga abre detalles
- [ ] kWh reales se calculan correctamente
- [ ] Editar funciona y guarda cambios
- [ ] Eliminar pide confirmación y borra

---

### FASE 6: Integración y Pulido Final

**Objetivo**: Testing completo y traducciones.

#### 6.1 Testing end-to-end
- Probar flujo completo: añadir → ver lista → ver detalle → editar → eliminar
- Probar en modo vertical y horizontal
- Probar en modo compacto
- Probar tema claro y oscuro

#### 6.2 Completar traducciones
Añadir todas las cadenas en los 6 idiomas soportados.

#### 6.3 Verificación final
- No hay errores en consola
- Datos persisten al recargar
- Performance aceptable
- UI consistente

---

## Órdenes para el LLM

### Prompt para FASE 1

```
Implementa la FASE 1 del registro de cargas en BYD-Stats.

CONTEXTO:
- Proyecto React con Tailwind CSS
- Datos se persisten en localStorage
- Hook useLocalStorage existe pero usaremos useState + useEffect directo

TAREAS:
1. Añadir constante CHARGES_STORAGE_KEY = 'byd_charges_data' en src/constants/layout.js

2. Crear src/hooks/useChargesData.js con:
   - Estado inicial que carga de localStorage
   - useEffect que persiste cambios
   - Funciones: addCharge, updateCharge, deleteCharge, getChargeById
   - Cada carga tiene: id, date, time, timestamp, odometer, kwhCharged, chargerTypeId, pricePerKwh, totalCost, finalPercentage, initialPercentage

VERIFICACIÓN:
- Crear un console.log temporal en App.jsx para verificar que el hook funciona
- Comprobar en DevTools > Application > localStorage que se guarda

NO hagas cambios en otros archivos. Solo layout.js y el nuevo hook.
```

### Prompt para FASE 2

```
Implementa la FASE 2 del registro de cargas en BYD-Stats.

CONTEXTO:
- La FASE 1 está completada (useChargesData existe)
- Settings se gestionan en src/context/AppContext.jsx
- El modal de settings está en src/components/modals/SettingsModal.jsx

TAREAS:
1. En src/context/AppContext.jsx:
   - Añadir chargerTypes al DEFAULT_SETTINGS con 4 tipos predefinidos:
     * domestic: 240V, 2.4 kW, 85% eficiencia
     * slow: Carga lenta, 7.4 kW, 90% eficiencia
     * fast: Carga rápida, 50 kW, 92% eficiencia
     * ultrafast: Carga ultrarrápida, 150 kW, 95% eficiencia
   - Añadir chargerTypes a la validación en updateSettings

2. En src/components/modals/SettingsModal.jsx:
   - Añadir sección "Tipos de cargadores" después del precio de electricidad
   - Lista editable de tipos con: nombre, velocidad (kW), eficiencia (0-1)
   - Botones para añadir nuevo tipo y eliminar existente
   - Usar el mismo estilo visual que el resto del modal

3. En public/locales/es.json:
   - Añadir traducciones: chargerTypes, chargerName, chargerSpeed, chargerEfficiency, addChargerType, deleteChargerType

VERIFICACIÓN:
- Abrir Settings y verificar que aparece la sección
- Editar un tipo y comprobar que persiste al recargar
- Añadir y eliminar tipos

Sigue exactamente los patrones de código existentes en SettingsModal.
```

### Prompt para FASE 3

```
Implementa la FASE 3 del registro de cargas en BYD-Stats.

CONTEXTO:
- FASES 1 y 2 completadas
- Tabs existentes en src/components/tabs/ usan React.memo y lazy loading
- Array de tabs definido en App.jsx con {id, label, icon}
- Hay dos modos de layout: vertical (swipe) y horizontal (sidebar)

TAREAS:
1. Crear src/components/tabs/ChargesTab.jsx:
   - Seguir patrón de HistoryTab.jsx (estructura similar)
   - Usar React.memo
   - Props: charges, onChargeClick, onAddClick
   - Estado vacío: icono Battery + mensajes
   - Lista de cargas: cada item muestra fecha, hora, kWh, coste
   - Usar useLayout para isCompact, isVertical

2. En src/App.jsx:
   - Import lazy: const ChargesTab = lazy(...)
   - Añadir al array tabs: { id: 'charges', label: t('tabs.charges'), icon: Battery }
   - Importar Battery de Icons.jsx si no está
   - Añadir render de ChargesTab en AMBOS layouts (vertical y horizontal)
   - Pasar props: charges, onChargeClick, onAddClick
   - Instanciar useChargesData en App.jsx

3. En public/locales/es.json:
   - tabs.charges: "Cargas"
   - charges.title: "Registro de Cargas"
   - charges.noCharges: "No hay cargas registradas"
   - charges.addFirst: "Pulsa + para añadir tu primera carga"

VERIFICACIÓN:
- La tab aparece en navegación
- Se puede navegar por swipe y click
- Muestra estado vacío correctamente
- No rompe otras tabs

Busca el patrón exacto de cómo se renderizan las tabs existentes y replica.
```

### Prompt para FASE 4

```
Implementa la FASE 4 del registro de cargas en BYD-Stats.

CONTEXTO:
- FASES 1-3 completadas
- Tab ChargesTab existe y funciona
- Modales se gestionan con useModalState.js
- ModalContainer.jsx renderiza todos los modales lazy-loaded
- Patrón de modal: ModalHeader + contenido + botón primario

TAREAS:
1. Crear src/components/common/FloatingActionButton.jsx:
   - Botón redondo fijo en esquina inferior derecha
   - Posición: right: 1rem, bottom: calc(5rem + env(safe-area-inset-bottom))
   - Color BYD_RED, icono Plus por defecto
   - Props: onClick, icon, label

2. Crear src/components/modals/AddChargeModal.jsx:
   - Seguir patrón de SettingsModal (estructura, estilos)
   - Props: isOpen, onClose, onSave, chargerTypes, defaultPricePerKwh, editingCharge
   - Campos del formulario (ver documento de planificación)
   - Auto-calcular totalCost cuando cambie kwhCharged o pricePerKwh
   - Validación básica antes de guardar

3. Modificar src/hooks/useModalState.js:
   - Añadir addCharge: false y chargeDetail: false al estado inicial
   - Añadir en closeAllModals también

4. Modificar src/components/common/ModalContainer.jsx:
   - Lazy import de AddChargeModal
   - Renderizar con las props correctas

5. Integrar FloatingActionButton en ChargesTab:
   - Renderizar al final del componente
   - onClick abre modal addCharge

6. Traducciones en es.json:
   - charges.addCharge, charges.editCharge, charges.odometer, charges.kwhCharged
   - charges.chargerType, charges.pricePerKwh, charges.totalCost
   - charges.date, charges.time, charges.finalPercentage, charges.initialPercentage
   - charges.save, charges.optional, charges.fillRequired

VERIFICACIÓN:
- Botón "+" visible y no superpuesto con tabs
- Modal se abre al pulsar
- Campos funcionan y auto-calculan coste
- Guardar añade la carga a la lista

Revisa TripDetailModal.jsx y FilterModal.jsx como referencia adicional de modales.
```

### Prompt para FASE 5

```
Implementa la FASE 5 del registro de cargas en BYD-Stats.

CONTEXTO:
- FASES 1-4 completadas
- Se pueden añadir cargas y se muestran en lista
- Falta modal de detalles y funcionalidad de editar/eliminar

TAREAS:
1. Crear src/components/modals/ChargeDetailModal.jsx:
   - Seguir patrón de TripDetailModal.jsx
   - Props: isOpen, onClose, charge, chargerTypes, onEdit, onDelete
   - Mostrar TODOS los campos de la carga
   - Calcular y mostrar kWh reales = kwhCharged × eficiencia del chargerType
   - Botones: Editar (abre AddChargeModal con editingCharge), Eliminar (confirmación)

2. Actualizar ChargesTab.jsx:
   - Añadir resumen de estadísticas (total kWh, coste total, número de cargas)
   - Mejorar tarjetas de carga (mostrar tipo de cargador)
   - Formatear fechas correctamente (usar formatDate si existe)

3. En ModalContainer.jsx:
   - Añadir ChargeDetailModal lazy-loaded
   - Gestionar estado de selectedCharge

4. En App.jsx:
   - Crear handleChargeClick que abre chargeDetail y setea selectedCharge
   - Crear handleEditCharge que abre addCharge con editingCharge
   - Crear handleDeleteCharge que llama deleteCharge y cierra modal

5. Traducciones:
   - charges.chargeDetail, charges.realKwh, charges.efficiency
   - charges.edit, charges.delete, charges.confirmDelete
   - charges.summary, charges.totalKwh, charges.totalCost, charges.chargeCount

VERIFICACIÓN:
- Click en carga abre detalles completos
- kWh reales se calculan correctamente (mostrar fórmula)
- Editar abre modal pre-rellenado y guarda cambios
- Eliminar pide confirmación y borra

Asegúrate de que la eficiencia se aplica correctamente: realKwh = kwhCharged * efficiency
```

### Prompt para FASE 6

```
Implementa la FASE 6 (final) del registro de cargas en BYD-Stats.

CONTEXTO:
- FASES 1-5 completadas
- Toda la funcionalidad básica implementada
- Falta: traducciones completas, pulido UI, testing

TAREAS:
1. Completar traducciones en TODOS los idiomas:
   - public/locales/en.json (inglés)
   - public/locales/ca.json (catalán)
   - public/locales/gl.json (gallego)
   - public/locales/eu.json (euskera)
   - public/locales/pt.json (portugués)

   Traducir todas las claves de "charges" y "settings.chargerTypes"

2. Revisar y pulir UI:
   - Verificar espaciado en modo compacto
   - Verificar colores en tema oscuro
   - Asegurar que el botón flotante no molesta en ningún modo
   - Formatear números correctamente (decimales, moneda)

3. Testing manual:
   - Flujo completo: añadir → listar → detalle → editar → eliminar
   - Probar en modo vertical (simular móvil)
   - Probar en modo horizontal (tablet/desktop)
   - Probar en modo compacto (pantalla BYD)
   - Probar tema claro y oscuro
   - Verificar persistencia (recargar página)

4. Verificar que no hay regresiones:
   - Todas las tabs existentes funcionan
   - Swipe entre tabs funciona
   - Filtros y otros modales funcionan

5. Limpieza:
   - Eliminar console.logs de debug
   - Verificar que no hay warnings en consola
   - Verificar que PropTypes están completos

VERIFICACIÓN FINAL:
- [ ] Todas las funcionalidades operativas
- [ ] Traducciones en 6 idiomas
- [ ] UI consistente en todos los modos
- [ ] Sin errores en consola
- [ ] Datos persisten correctamente
- [ ] Performance aceptable

Esta es la fase final. Asegúrate de que todo está pulido y listo para producción.
```

---

## Notas Adicionales

### Consideraciones de UX
- El botón flotante debe tener suficiente contraste y no molestar la navegación
- Los modales deben poder cerrarse con el botón back en Android
- El auto-cálculo del coste mejora la experiencia del usuario

### Consideraciones Técnicas
- Usar `crypto.randomUUID()` para IDs únicos
- Ordenar cargas por timestamp descendente (más recientes primero)
- Validar datos antes de guardar para evitar inconsistencias

### Futuras Mejoras (fuera de scope actual)
- Gráficos de coste por mes
- Exportar datos de cargas
- Importar desde CSV
- Integración con APIs de precios de electricidad
- Estadísticas avanzadas (coste por km, comparativa de cargadores)
