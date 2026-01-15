import React, { Suspense } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { BYD_RED, Plus, Upload, HelpCircle, Bug, GitHub, Mail, Shield, Heart } from '../Icons.jsx';

// Lazy loaded modals must be passed or imported here. 
// Since we want to keep code splitting effective, we'll accept them as props or import them lazily here.
// Importing here ensures they are only loaded when ModalContainer is loaded (which is always), 
// but their chunking depends on usage.
// Actually, App.jsx was lazy loading them. We should probably keep lazy loading here.

const SettingsModalLazy = React.lazy(() => import('../modals/SettingsModal'));
const FilterModalLazy = React.lazy(() => import('../modals/FilterModal'));
const TripDetailModalLazy = React.lazy(() => import('../modals/TripDetailModal'));
const DatabaseUploadModalLazy = React.lazy(() => import('../modals/DatabaseUploadModal'));
const LegalModalLazy = React.lazy(() => import('../modals/LegalModal'));
const AddChargeModalLazy = React.lazy(() => import('../modals/AddChargeModal'));
const ChargeDetailModalLazy = React.lazy(() => import('../modals/ChargeDetailModal'));

const ModalContainer = ({
    modals,
    closeModal,
    openModal,
    setLegalInitialSection,
    legalInitialSection,
    // Data props
    settings,
    updateSettings,
    googleSync,
    rawTrips,
    selectedTrip,
    setSelectedTrip,
    data,
    sqlReady,
    processDB,
    exportDatabase,
    clearData,
    onLoadChargeRegistry,
    isNative,
    onFile,
    setFilterType,
    setSelMonth,
    setDateFrom,
    setDateTo,
    filterType,
    selMonth,
    dateFrom,
    dateTo,
    months,
    rawTripsCount,
    filteredCount,
    appVersion = 'v1.2', // Dynamic version from GitHub releases
    // Charges data and modal props
    charges,
    onSaveCharge,
    editingCharge,
    setEditingCharge,
    selectedCharge,
    setSelectedCharge,
    onEditCharge,
    onDeleteCharge
}) => {
    const { t } = useTranslation();

    // Handlers
    const handleSettingsClose = () => closeModal('settings');
    const handleFilterClose = () => closeModal('filter');
    const handleUploadClose = () => closeModal('upload');
    const handleHistoryClose = () => closeModal('history');
    const handleTripDetailClose = () => { closeModal('tripDetail'); setSelectedTrip(null); };
    const handleLegalClose = () => closeModal('legal');
    const handleHelpClose = () => closeModal('help');
    const handleAddChargeClose = () => { closeModal('addCharge'); if (setEditingCharge) setEditingCharge(null); };
    const handleChargeDetailClose = () => { closeModal('chargeDetail'); if (setSelectedCharge) setSelectedCharge(null); };



    return (
        <>
            {/* Upload Modal (was 'showModal' in App.jsx) */}
            {modals.upload && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={handleUploadClose}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">{t('settings.updateData')}</h3>
                        <div className="space-y-3">
                            <label className="block cursor-pointer border-2 border-dashed border-slate-600 rounded-xl p-6 text-center hover:border-green-500 transition-colors">
                                <input type="file" accept="*/*,image/*,.db,.jpg,.jpeg" className="hidden" onChange={(e) => onFile(e, true)} />
                                <Plus className="w-8 h-8 mx-auto mb-2 text-green-500" />
                                <p className="text-slate-900 dark:text-white">{t('upload.mergeExisting')}</p>
                            </label>
                            <label className="block cursor-pointer border-2 border-dashed border-slate-600 rounded-xl p-6 text-center hover:border-amber-500 transition-colors">
                                <input type="file" accept="*/*,image/*,.db,.jpg,.jpeg" className="hidden" onChange={(e) => onFile(e, false)} />
                                <Upload className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                                <p className="text-slate-900 dark:text-white">{t('upload.replaceAll')}</p>
                            </label>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={handleUploadClose} className="flex-1 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600">{t('common.cancel')}</button>
                            <button onClick={clearData} className="py-2 px-4 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30">{t('upload.deleteAll')}</button>
                        </div>
                    </div>
                </div>
            )}

            <Suspense fallback={null}>
                {/* Trip Detail Modal */}
                <TripDetailModalLazy
                    isOpen={modals.tripDetail}
                    onClose={handleTripDetailClose}
                    trip={selectedTrip}
                    allTrips={rawTrips}
                    summary={data?.summary}
                    settings={settings}
                />

                {/* Settings Modal */}
                <SettingsModalLazy
                    isOpen={modals.settings}
                    onClose={handleSettingsClose}
                    settings={settings}
                    onSettingsChange={updateSettings}
                    googleSync={googleSync}
                    charges={charges}
                />

                {/* Database Management Modal */}
                <DatabaseUploadModalLazy
                    isOpen={modals.history}
                    onClose={handleHistoryClose}
                    sqlReady={sqlReady}
                    onFileSelect={processDB}
                    onExport={exportDatabase}
                    onClearData={clearData}
                    onLoadChargeRegistry={onLoadChargeRegistry}
                    hasData={rawTrips.length > 0}
                    isNative={isNative}
                />

                {/* Filter Modal */}
                <FilterModalLazy
                    isOpen={modals.filter}
                    onClose={handleFilterClose}
                    filterType={filterType}
                    setFilterType={setFilterType}
                    selMonth={selMonth}
                    setSelMonth={setSelMonth}
                    dateFrom={dateFrom}
                    setDateFrom={setDateFrom}
                    dateTo={dateTo}
                    setDateTo={setDateTo}
                    months={months}
                    rawTripsCount={rawTripsCount || (rawTrips ? rawTrips.length : 0)}
                    filteredCount={filteredCount || 0}
                />

                {/* Legal Modal */}
                <LegalModalLazy
                    isOpen={modals.legal}
                    onClose={handleLegalClose}
                    initialSection={legalInitialSection}
                />

                {/* Add/Edit Charge Modal */}
                <AddChargeModalLazy
                    isOpen={modals.addCharge}
                    onClose={handleAddChargeClose}
                    onSave={onSaveCharge}
                    chargerTypes={settings?.chargerTypes || []}
                    defaultPricePerKwh={settings?.electricityPrice || 0.15}
                    editingCharge={editingCharge}
                />

                {/* Charge Detail Modal */}
                <ChargeDetailModalLazy
                    isOpen={modals.chargeDetail}
                    onClose={handleChargeDetailClose}
                    charge={selectedCharge}
                    chargerTypes={settings?.chargerTypes || []}
                    onEdit={onEditCharge}
                    onDelete={onDeleteCharge}
                />
            </Suspense>

            {/* Help/Bug Report Modal */}
            {modals.help && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={handleHelpClose}>
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
                    <div className="relative bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <HelpCircle className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('help.title')}</h2>
                            </div>
                            <button onClick={handleHelpClose} className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
                                <Plus className="w-6 h-6 rotate-45" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-4">
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                                    {t('help.subtitle')}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-500">
                                    {t('help.description')}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <a
                                    href="https://github.com/miguelpicado/byd-stats/issues/new"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full py-3 rounded-xl font-medium text-white flex items-center justify-center gap-2"
                                    style={{ backgroundColor: BYD_RED }}
                                >
                                    <Bug className="w-5 h-5" />
                                    {t('help.reportBug')}
                                </a>

                                <a
                                    href="https://github.com/miguelpicado/byd-stats"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full py-3 rounded-xl font-medium text-slate-900 dark:text-white bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                                >
                                    <GitHub className="w-5 h-5" />
                                    {t('footer.github')}
                                </a>

                                <a
                                    href="mailto:contacto@bydstats.com?subject=BYD Stats - Contacto&body=Hola,%0A%0AMe gustaría contactar sobre..."
                                    className="w-full py-3 rounded-xl font-medium text-slate-900 dark:text-white bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Mail className="w-5 h-5" />
                                    {t('footer.email')}
                                </a>

                                <button
                                    onClick={() => { setLegalInitialSection('privacy'); openModal('legal'); }}
                                    className="w-full py-3 rounded-xl font-medium text-slate-900 dark:text-white bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Shield className="w-5 h-5" />
                                    {t('footer.legal')}
                                </button>
                            </div>

                            {/* Ko-Fi Donation Section */}
                            <div className="pt-4 mt-6 border-t border-slate-200 dark:border-slate-700">
                                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-3">
                                    <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                                    {t('help.supportDev')}
                                </h3>
                                <a
                                    href="https://ko-fi.com/miguelpicado"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-3 w-full py-3 px-4 bg-[#f69a1d] hover:bg-[#e08b1a] text-white rounded-xl font-bold transition-all shadow-sm hover:shadow-md active:scale-95 no-underline"
                                >
                                    <img
                                        src="https://ko-fi.com/img/cup-border.png"
                                        alt="Ko-fi"
                                        className="w-5 h-auto brightness-0 invert"
                                    />
                                    <span>{t('help.buyMeCoffee')}</span>
                                </a>
                            </div>

                            <div className="text-center text-xs text-slate-500 dark:text-slate-500 pt-2">
                                <p>BYD Stats Analyzer {appVersion}</p>
                                <p className="mt-1">{t('footer.madeWith')}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

ModalContainer.propTypes = {
    modals: PropTypes.object.isRequired,
    closeModal: PropTypes.func.isRequired,
    openModal: PropTypes.func.isRequired,
    setLegalInitialSection: PropTypes.func,
    legalInitialSection: PropTypes.string,
    settings: PropTypes.object,
    updateSettings: PropTypes.func,
    googleSync: PropTypes.object,
    rawTrips: PropTypes.array,
    selectedTrip: PropTypes.object,
    setSelectedTrip: PropTypes.func,
    data: PropTypes.object,
    sqlReady: PropTypes.bool,
    processDB: PropTypes.func,
    exportDatabase: PropTypes.func,
    clearData: PropTypes.func,
    onLoadChargeRegistry: PropTypes.func,
    isNative: PropTypes.bool,
    onFile: PropTypes.func,
    setFilterType: PropTypes.func,
    setSelMonth: PropTypes.func,
    setDateFrom: PropTypes.func,
    setDateTo: PropTypes.func,
    filterType: PropTypes.string,
    selMonth: PropTypes.string,
    dateFrom: PropTypes.string,
    dateTo: PropTypes.string,
    months: PropTypes.array,
    rawTripsCount: PropTypes.number,
    filteredCount: PropTypes.number,
    appVersion: PropTypes.string,
    charges: PropTypes.array,
    onSaveCharge: PropTypes.func,
    editingCharge: PropTypes.object,
    setEditingCharge: PropTypes.func,
    selectedCharge: PropTypes.object,
    setSelectedCharge: PropTypes.func,
    onEditCharge: PropTypes.func,
    onDeleteCharge: PropTypes.func
};

export default React.memo(ModalContainer);
