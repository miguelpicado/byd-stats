import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Info, Activity, Clock, Zap, Target, FileText, TrendingUp, Filter, RefreshCw } from '../Icons'; // Added icons
import ModalPortal from '../common/ModalPortal';
import { useData } from '@/providers/DataProvider';

export type SoHMetricType = 'sei' | 'cycle' | 'calendar' | 'calibration' | 'formula' | 'ai_soh' | 'samples';

interface SoHExplanationModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: SoHMetricType | null;
}

const SoHExplanationModal: React.FC<SoHExplanationModalProps> = ({
    isOpen,
    onClose,
    type
}) => {
    const { t } = useTranslation();
    const { forceRecalculate, isAiTraining } = useData();

    const handleRecalculate = () => {
        if (forceRecalculate) {
            forceRecalculate();
        }
    };

    if (!isOpen || !type) return null;

    const getContent = () => {
        switch (type) {
            case 'sei':
                // ... (previous SEI content)
                return {
                    title: 'SEI (Solid Electrolyte Interphase)',
                    icon: Zap,
                    color: 'text-amber-500',
                    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
                    definition: 'La capa SEI es una película pasivante que se forma en el ánodo de la batería durante los primeros ciclos de carga y continúa creciendo lentamente con el tiempo.',
                    calculation: 'Se calcula basándose principalmente en el tiempo transcurrido desde la fabricación y se acelera ligeramente con el uso inicial. Es el factor dominante en la degradación temprana.',
                    impact: 'El crecimiento excesivo de la capa SEI aumenta la resistencia interna de la batería y consume iones de litio activos, reduciendo permanentemente la capacidad disponible (kWh) y la potencia máxima.'
                };
            case 'cycle':
                return {
                    title: 'Degradación Cíclica (Cycles)',
                    icon: Activity,
                    color: 'text-orange-500',
                    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
                    definition: 'Representa el desgaste físico y químico de los materiales activos (cátodo y ánodo) causado por la carga y descarga repetida de la batería.',
                    calculation: 'Se calcula contando los ciclos completos equivalentes (1 ciclo = 1 carga de 0 a 100%) y aplicando un factor de estrés basado en la profundidad de descarga (DoD) y las corrientes altas (C-rate).',
                    impact: 'Cada ciclo provoca micro-grietas en la estructura de los electrodos y pérdida de contacto eléctrico. A mayor número de ciclos profundos o cargas rápidas, mayor es la pérdida de capacidad.'
                };
            case 'calendar':
                return {
                    title: 'Envejecimiento Calendario (Time)',
                    icon: Clock,
                    color: 'text-red-500',
                    bgColor: 'bg-red-100 dark:bg-red-900/30',
                    definition: 'Es la degradación natural que ocurre incluso cuando la batería no se usa, debido a reacciones químicas parásitas que ocurren con el simple paso del tiempo.',
                    calculation: 'Depende de la "Edad" de la batería y está fuertemente influenciado por la temperatura promedio de almacenamiento y el estado de carga (SoC) al que se mantiene en reposo.',
                    impact: 'Mantener la batería al 100% de carga o en ambientes muy calurosos durante largos periodos acelera drásticamente este factor, reduciendo la capacidad total independientemente del kilometraje.'
                };
            case 'calibration':
                return {
                    title: t('modals.bms.title', 'BMS y Calibración LFP'),
                    icon: Target,
                    color: 'text-emerald-500',
                    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
                    definition: t('modals.bms.definition', 'En baterías LFP, la curva de voltaje es muy plana, lo que dificulta a la BMS saber la energía exacta sin llegar a los extremos. Por ello, el desbalanceo es habitual y esperable en esta tecnología.'),
                    calculation: t('modals.bms.calculation', 'El aviso aparece si la BMS detecta diferencias de voltaje entre celdas o si ha pasado mucho tiempo sin alcanzar el 100%. Necesita ese punto de referencia (top balancing) para resincronizarse.'),
                    impact: t('modals.bms.impact', 'Se recomienda cargar al 100% al menos una vez al mes y dejarlo enchufado unas horas extra para el balanceo. Las baterías LFP son robustas y toleran bien el 100%, especialmente si se usa el coche poco después de terminar el balanceo.')
                };
            case 'formula':
                return {
                    title: t('modals.formula.title', 'Fórmula Teórica SoH'),
                    icon: FileText,
                    color: 'text-slate-500',
                    bgColor: 'bg-slate-100 dark:bg-slate-800',
                    definition: t('modals.formula.definition', 'Estimación matemática basada en la química de las celdas LFP y el historial de uso del vehículo.\n\nConstantes utilizadas:\n• SEI: Máximo 2% (primeros 50 ciclos)\n• Ciclos: 0.005% por ciclo (ajustado por estrés)\n• Tiempo: 0.75% por año'),
                    calculation: t('modals.formula.calculation', 'SoH = 100% - SEI - (Ciclos × 0.005% × Estrés) - (Años × 0.75%)'),
                    impact: t('modals.formula.impact', 'Este valor es una aproximación teórica. El SoH real puede variar y la BMS del coche es la que tiene la última palabra sobre la capacidad usable actual.')
                };
            case 'ai_soh':
                return {
                    title: t('modals.ai_soh.title', 'SoH Real (Análisis IA)'),
                    icon: TrendingUp,
                    color: 'text-emerald-600',
                    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
                    definition: t('modals.ai_soh.definition', 'Cálculo empírico basado en tus sesiones de carga reales. La IA analiza cuánta energía entra realmente en la batería vs. el porcentaje reportado por el coche.'),
                    calculation: t('modals.ai_soh.calculation', "Usa regresión lineal sobre tus cargas históricas para encontrar la 'capacidad total efectiva' actual."),
                    impact: t('modals.ai_soh.impact', 'Este valor es más preciso que el teórico porque refleja la salud real de tus celdas.')
                };
            case 'samples':
                return {
                    title: t('modals.samples.title', 'Muestras de Calidad'),
                    icon: Filter,
                    color: 'text-slate-500',
                    bgColor: 'bg-slate-100 dark:bg-slate-800',
                    definition: t('modals.samples.definition', 'Número de sesiones de carga que la IA ha considerado válidas para su cálculo.'),
                    calculation: t('modals.samples.calculation', 'La IA descarta automáticamente cargas pequeñas (<15-20%), cargas muy lentas o con interrupciones.'),
                    impact: t('modals.samples.impact', 'Es normal tener menos muestras que cargas totales. Cuantas más muestras de calidad tengas, más preciso será el cálculo.')
                };
            default:
                return null;
        }
    };

    const content = getContent();
    if (!content) return null;

    const Icon = content.icon;

    return (
        <ModalPortal>
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-modal-backdrop" onClick={onClose}>
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

                <div
                    role="dialog"
                    aria-modal="true"
                    className="relative bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full shadow-2xl animate-modal-content overflow-hidden border border-slate-200 dark:border-slate-700"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${content.bgColor}`}>
                                <Icon className={`w-5 h-5 ${content.color}`} />
                            </div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                                {content.title}
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-5 space-y-5">
                        <div className="space-y-2">
                            <h3 className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                <Info className="w-3 h-3" />
                                ¿Qué es?
                            </h3>
                            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                {content.definition}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                ¿Cómo se calcula?
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                                {content.calculation}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Impacto en la batería
                            </h3>
                            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                {content.impact}
                            </p>
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-700 flex justify-center gap-3">
                        {type === 'ai_soh' && (
                            <button
                                onClick={handleRecalculate}
                                disabled={isAiTraining}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${isAiTraining
                                    ? 'bg-slate-100 text-slate-400 cursor-wait'
                                    : 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30'
                                    }`}
                            >
                                <RefreshCw className={`w-4 h-4 ${isAiTraining ? 'animate-spin' : ''}`} />
                                {isAiTraining ? t('common.calculating', 'Recalculando...') : t('common.recalculate', 'Recalcular')}
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-4 py-2"
                        >
                            {t('common.close', 'Cerrar')}
                        </button>
                    </div>
                </div>
            </div>
        </ModalPortal>
    );
};

export default SoHExplanationModal;
