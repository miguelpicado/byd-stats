import React from 'react';
import { Shield, AlertCircle } from './Icons.jsx';

const LegalContent = ({ section = 'privacy' }) => {
    if (section === 'privacy') {
        return (
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
        );
    }

    return (
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
    );
};

export default LegalContent;
