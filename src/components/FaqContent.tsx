import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpCircle, Database, Smartphone, Heart, Mail, ChevronDown, ChevronUp } from './Icons';

const FaqItem = ({ question, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border-b border-slate-100 dark:border-slate-800 last:border-0">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full py-4 flex items-center justify-between gap-4 text-left group"
            >
                <h4 className="font-bold text-slate-900 dark:text-white text-base group-hover:text-red-600 transition-colors">
                    {question}
                </h4>
                {isOpen ? (
                    <ChevronUp className="w-5 h-5 text-slate-400 min-w-[20px]" />
                ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400 min-w-[20px]" />
                )}
            </button>

            <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[500px] opacity-100 mb-4' : 'max-h-0 opacity-0'}`}
            >
                <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {children}
                </div>
            </div>
        </div>
    );
};

const FaqContent = () => {
    const { t } = useTranslation();

    return (
        <div className="max-w-none space-y-8">
            {/* General Section */}
            <section>
                <div className="flex items-center gap-2 mb-2">
                    <HelpCircle className="w-6 h-6 text-red-600" />
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white m-0">{t('faq.general.title')}</h3>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl px-4 sm:px-6">
                    <FaqItem question={t('faq.general.q1')} defaultOpen={true}>
                        {t('faq.general.a1')}
                    </FaqItem>
                    <FaqItem question={t('faq.general.q2')}>
                        {t('faq.general.a2')}
                    </FaqItem>
                    <FaqItem question={t('faq.general.q3')}>
                        {t('faq.general.a3')}
                    </FaqItem>
                    {/* NEW: Short Trips / Efficiency 0 */}
                    <FaqItem question={t('faq.general.q_no_efficiency') || "¿Por qué no veo eficiencia o Score en algunos viajes?"}>
                        {t('faq.general.a_no_efficiency') || "Los viajes de menos de 0.5km no muestran eficiencia ni puntaje (Score) y aparecen con un guion. Esto se debe a que distancias tan cortas con consumos de arranque o climatización generarían eficiencias artificialmente altas (ej. 200 kWh/100km). Para evitar distorsionar tus estadísticas, estos consumos se consideran 'Consumo en Parado' y se suman en su propia tarjeta en la pantalla de Resumen, pero se excluyen de los promedios de eficiencia."}
                    </FaqItem>
                    {/* NEW: Score Explanation */}
                    <FaqItem question={t('faq.general.q_score_works') || "¿Cómo funciona el Score?"}>
                        {t('faq.general.a_score_works') || "El Score es una puntuación de 0 a 10 que evalúa tu eficiencia de conducción. Se basa en una escala predefinida (configurable en ajustes por el desarrollador, usualmente 13-18 kWh/100km). Menos consumo da mayor puntuación. El Score ayuda a gamificar y entender rápidamente cuán eficiente ha sido un viaje sin tener que interpretar los kWh exactos."}
                    </FaqItem>
                    {/* NEW: Cost Types Explanation */}
                    <FaqItem question={t('faq.general.q_cost_types') || "¿Qué significan los 3 tipos de coste en Configuración?"}>
                        <p className="mb-2">{t('faq.general.a_cost_types_intro') || "En Configuración > Precios puedes elegir cómo calcular el coste de tus viajes:"}</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>{t('settings.custom') || "Precio Fijo"}:</strong> {t('faq.general.a_cost_fixed') || "Usa el valor manual que introduzcas en el campo de precio. Es útil si siempre cargas al mismo precio."}</li>
                            <li><strong>{t('settings.average') || "Precio Medio"}:</strong> {t('faq.general.a_cost_avg') || "Calcula automáticamente el precio medio de TODAS tus cargas registradas (Coste Total / kWh Totales) y lo aplica a todos los viajes. Es bueno para tener una estimación global."}</li>
                            <li><strong>{t('settings.dynamic') || "Dinámico"}:</strong> {t('faq.general.a_cost_dynamic') || "El más preciso. Busca la carga registrada más reciente anterior al viaje y usa ese precio específico. Si cargas gratis en el súper y luego viajas, el viaje constará como 0€."}</li>
                        </ul>
                    </FaqItem>
                </div>
            </section>

            {/* Database Section */}
            <section>
                <div className="flex items-center gap-2 mb-2">
                    <Database className="w-6 h-6 text-red-600" />
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white m-0">{t('faq.database.title')}</h3>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl px-4 sm:px-6">
                    <FaqItem question={t('faq.database.q1')}>
                        <p className="mb-2">{t('faq.database.a1_intro')}</p>
                        <ol className="list-decimal pl-5 space-y-1 mb-3">
                            <li>{t('faq.database.a1_step1')}</li>
                            <li>{t('faq.database.a1_step2')}</li>
                            <li>{t('faq.database.a1_step3')}</li>
                            <li>{t('faq.database.a1_step4')}</li>
                        </ol>
                        <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-lg p-3 text-yellow-800 dark:text-yellow-200">
                            <strong>{t('faq.database.tip_label')}: </strong> {t('faq.database.tip_text')}
                        </div>
                    </FaqItem>
                    <FaqItem question={t('faq.database.q_csv_import') || "¿Puedo importar mis propias cargas/viajes?"}>
                        <p className="mb-2">
                            {t('faq.database.a_csv_import') || "Sí, puedes importar tus datos desde archivos CSV. Descarga las plantillas oficiales desde GitHub para asegurarte de usar el formato correcto:"}
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>
                                <a
                                    href="https://github.com/miguelpicado/byd-stats/blob/main/REGISTRO_CARGAS.csv"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-bold text-red-600 hover:text-red-700 underline"
                                >
                                    REGISTRO_CARGAS.csv
                                </a> {t('faq.database.a_csv_charges') || "- Plantilla para importar cargas"}
                            </li>
                            <li>
                                <a
                                    href="https://github.com/miguelpicado/byd-stats/blob/main/REGISTRO_VIAJES.csv"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-bold text-red-600 hover:text-red-700 underline"
                                >
                                    REGISTRO_VIAJES.csv
                                </a> {t('faq.database.a_csv_trips') || "- Plantilla para importar viajes"}
                            </li>
                        </ul>
                    </FaqItem>
                </div>
            </section>

            {/* Installation Section */}
            <section>
                <div className="flex items-center gap-2 mb-2">
                    <Smartphone className="w-6 h-6 text-red-600" />
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white m-0">{t('faq.install.title')}</h3>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl px-4 sm:px-6">
                    <FaqItem question={t('faq.install.q1')}>
                        <p className="mb-2">{t('faq.install.a1_intro')}</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>iOS (Safari):</strong> {t('faq.install.a1_ios')}</li>
                            <li><strong>Android (Chrome):</strong> {t('faq.install.a1_android')}</li>
                        </ul>
                    </FaqItem>
                    <FaqItem question={t('faq.install.q2')}>
                        <p className="mb-2">{t('faq.install.a2_intro')}</p>
                        <ol className="list-decimal pl-5 space-y-1">
                            <li>{t('faq.install.a2_step1')}</li>
                            <li>{t('faq.install.a2_step2')}</li>
                            <li>{t('faq.install.a2_step3')}</li>
                        </ol>
                    </FaqItem>
                </div>
            </section>

            {/* Support Section */}
            <section>
                <div className="flex items-center gap-2 mb-2">
                    <Heart className="w-6 h-6 text-red-600" />
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white m-0">{t('faq.support.title')}</h3>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl px-4 sm:px-6">
                    <FaqItem question={t('faq.support.q1')}>
                        <p className="mb-4">{t('faq.support.a1')}</p>
                        <a
                            href="https://ko-fi.com/miguelpicado"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-[#f69a1d] hover:bg-[#e08b1a] text-white rounded-xl font-bold transition-all shadow-sm hover:shadow-md no-underline text-sm"
                        >
                            <img
                                src="https://ko-fi.com/img/cup-border.png"
                                alt="Ko-fi"
                                className="w-4 h-auto brightness-0 invert"
                            />
                            <span>{t('help.buyMeCoffee')}</span>
                        </a>
                    </FaqItem>

                    <FaqItem question={t('faq.support.q2')}>
                        <p>
                            {t('faq.support.a2')}
                            <a href="mailto:contacto@bydstats.com" className="font-bold text-red-600 hover:text-red-700 ml-1">
                                contacto@bydstats.com
                            </a>
                        </p>
                    </FaqItem>
                </div>
            </section>
        </div>
    );
};

export default FaqContent;


