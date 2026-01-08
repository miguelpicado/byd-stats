import React from 'react';
import { X, Shield, FileText, AlertCircle, HelpCircle } from '../Icons';

const LegalModal = ({ isOpen, onClose, initialSection = 'privacy' }) => {
    const [activeSection, setActiveSection] = React.useState(initialSection);

    if (!isOpen) return null;

    const sections = [
        { id: 'privacy', label: 'Privacidad', icon: Shield },
        { id: 'legal', label: 'Aviso Legal', icon: FileText },
    ];

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            ></div>

            <div
                className="relative bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                            <Shield className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Documentación Legal</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">BYD Stats Analyzer</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-500"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 dark:border-slate-800">
                    {sections.map((s) => (
                        <button
                            key={s.id}
                            onClick={() => setActiveSection(s.id)}
                            className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-all border-b-2 ${activeSection === s.id
                                    ? 'border-red-600 text-red-600 bg-red-50/10'
                                    : 'border-transparent text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                }`}
                        >
                            <s.icon className="w-4 h-4" />
                            {s.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {activeSection === 'privacy' && (
                        <div className="prose prose-slate dark:prose-invert max-w-none">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Política de Privacidad</h3>

                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6 flex gap-3">
                                <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-blue-700 dark:text-blue-400">
                                    Resumen: Tus datos son **tuyos**. BYD Stats funciona localmente y no vende ni envía tu información a servidores externos de forma automática.
                                </p>
                            </div>

                            <section className="space-y-3">
                                <h4 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">1. Recopilación de Datos</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    La aplicación procesa exclusivamente los datos contenidos en el archivo <code>EC_Database.db</code> generado por tu vehículo BYD. Estos datos incluyen registros de viajes, eficiencia, consumos y ubicaciones (coordenadas GPS de inicio/fin si las guardas).
                                </p>
                            </section>

                            <section className="space-y-3">
                                <h4 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">2. Uso de la Información</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    La información se utiliza únicamente para generar las estadísticas, gráficas y reportes que ves en la pantalla. No realizamos seguimiento de usuario ni profiling publicitario.
                                </p>
                            </section>

                            <section className="space-y-3">
                                <h4 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">3. Almacenamiento y Seguridad</h4>
                                <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-400 space-y-1">
                                    <li><strong>Local:</strong> Los datos se guardan en el almacenamiento local de tu navegador o dispositivo (IndexedDB/LocalStorage).</li>
                                    <li><strong>Nube (Opcional):</strong> Si activas la Sincronización con Google Drive, los datos se subirán a tu cuenta privada de Google Drive (en la carpeta de "application data"). Solo tú tienes acceso a esos archivos.</li>
                                </ul>
                            </section>

                            <section className="space-y-3">
                                <h4 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">4. Servicios de Terceros</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    Utilizamos las APIs de Google solo para la función de sincronización opcional. Puedes consultar la política de privacidad de Google para saber cómo manejan ellos tu cuenta de Google.
                                </p>
                            </section>

                            <div className="pt-8 border-t border-slate-200 dark:border-slate-800">
                                <p className="text-[10px] text-slate-500 text-center">Última actualización: 8 de enero de 2026</p>
                            </div>
                        </div>
                    )}

                    {activeSection === 'legal' && (
                        <div className="prose prose-slate dark:prose-invert max-w-none">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Aviso Legal</h3>

                            <section className="space-y-3">
                                <h4 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">Sobre el proyecto</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    BYD Stats Analyzer es una herramienta de código abierto (Open Source) desarrollada por la comunidad y para la comunidad. No tenemos ninguna relación oficial con BYD Auto Co., Ltd. ni con sus filiales.
                                </p>
                            </section>

                            <section className="space-y-3">
                                <h4 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">Uso de marcas</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    Los nombres "BYD", los logotipos de los vehículos y otras marcas registradas mencionadas pertenecen a sus respectivos propietarios y se utilizan aquí únicamente con fines descriptivos e informativos.
                                </p>
                            </section>

                            <section className="space-y-3">
                                <h4 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">Limitación de responsabilidad</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    La aplicación se ofrece "tal cual" (as is), sin garantías de ningún tipo. No nos hacemos responsables de cualquier pérdida de datos, inexactitud en los cálculos o mal uso de la información obtenida. Los datos se extraen de archivos generados por el software del vehículo y pueden contener errores ajenos a esta aplicación.
                                </p>
                            </section>

                            <section className="space-y-3">
                                <h4 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">Contribuciones</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    Si deseas contribuir, reportar un error o revisar el código fuente, puedes hacerlo en nuestro repositorio oficial de GitHub.
                                </p>
                            </section>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 text-center">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-xl text-sm font-bold transition-all"
                    >
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LegalModal;
