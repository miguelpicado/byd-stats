import React, { Suspense, lazy } from 'react';
import { BYD_RED } from '@components/Icons';
import '@/core/chartSetup';

// Hooks
import { useAppOrchestrator } from '@hooks/useAppOrchestrator';

// Components
import GlobalListeners from '@components/GlobalListeners';
import MainLayout from '@features/MainLayout';
import ModalCoordinator from '@components/common/ModalCoordinator';
import LandingFooter from '@components/layout/LandingFooter';

// Lazy Components
const LandingPageLazy = lazy(() => import('@/pages/LandingPage'));
const AllTripsViewLazy = lazy(() => import('@features/dashboard/AllTripsView'));
const AllChargesViewLazy = lazy(() => import('@features/dashboard/AllChargesView'));

export default function BYDStatsAnalyzer() {
  // Detailed orchestration state
  const {
    // State
    loading,
    sqlReady,
    error,
    isLandingPage,
    isNative,
    appVersion,

    // Render Conditions
    showAllTripsModal,
    showAllChargesModal,

    // Sub-state Objects
    allTripsState,
    allChargesState,

    // Actions
    processDB,
    exportDatabase,
    clearData,
    loadChargeRegistry,
    openTripDetail,
    handleChargeSelect,

    // Refs
    allTripsScrollRef,
    allChargesScrollRef,

    // Pass-through props for views
    // Pass-through props for views
    rawTrips,
    charges,
    settings,
    googleSync,
    // modals,
    openModal,
    closeModal,
    // selectedTrip,
    // setSelectedTrip,
    selectedCharge,
    setSelectedCharge,
    // setLegalInitialSection,
    // legalInitialSection,
    // data,

    // Main Layout Props
    layoutMode,
    isCompact,
    activeTab,
    tabs,
    handleTabClick,
    isTransitioning,
    fadingTab,
    backgroundLoad,
    setSwipeContainer
  } = useAppOrchestrator();

  // Loading Screen
  if (loading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center px-4 overflow-hidden">
        <div className="text-center">
          <div className="w-16 h-16 border-4 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: BYD_RED, borderTopColor: 'transparent' }} />
          <p className="text-slate-900 dark:text-white text-lg md:text-xl">Procesando...</p>
        </div>
      </div>
    );
  }

  // Landing Page (No Data)
  if (isLandingPage) {
    return (
      <>
        <Suspense fallback={null}>
          <LandingPageLazy
            isCompact={isCompact}
            sqlReady={sqlReady}
            error={error}
            googleSync={googleSync}
            isNative={isNative}
            onFileProcess={processDB}
          />
        </Suspense>

        {/* ModalCoordinator - centralized modal handling with lazy loading context support */}
        <ModalCoordinator />

        {/* Extracted Footer */}
        <LandingFooter appVersion={appVersion} />
      </>
    );
  }

  // All Trips Full View
  if (showAllTripsModal) {
    return (
      <Suspense fallback={
        <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
        </div>
      }>
        <AllTripsViewLazy
          rawTrips={rawTrips}
          filterType={allTripsState.filterType}
          month={allTripsState.month}
          dateFrom={allTripsState.dateFrom}
          dateTo={allTripsState.dateTo}
          sortBy={allTripsState.sortBy}
          sortOrder={allTripsState.sortOrder as 'asc' | 'desc'}
          setFilterType={allTripsState.setFilterType}
          setMonth={allTripsState.setMonth}
          setDateFrom={allTripsState.setDateFrom}
          setDateTo={allTripsState.setDateTo}
          setSortBy={allTripsState.setSortBy}
          setSortOrder={allTripsState.setSortOrder as React.Dispatch<React.SetStateAction<'asc' | 'desc'>>}
          closeModal={closeModal as (modal: string) => void}
          openTripDetail={openTripDetail}
          scrollRef={allTripsScrollRef}
          isNative={isNative}
        />
      </Suspense>
    );
  }

  // All Charges Full View
  if (showAllChargesModal) {
    return (
      <Suspense fallback={
        <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
        </div>
      }>
        <AllChargesViewLazy
          charges={charges}
          chargerTypes={settings.chargerTypes || []}
          filterType={allChargesState.filterType}
          month={allChargesState.month}
          dateFrom={allChargesState.dateFrom}
          dateTo={allChargesState.dateTo}
          sortBy={allChargesState.sortBy}
          sortOrder={allChargesState.sortOrder as 'asc' | 'desc'}
          setFilterType={allChargesState.setFilterType}
          setMonth={allChargesState.setMonth}
          setDateFrom={allChargesState.setDateFrom}
          setDateTo={allChargesState.setDateTo}
          setSortBy={allChargesState.setSortBy}
          setSortOrder={allChargesState.setSortOrder as React.Dispatch<React.SetStateAction<'asc' | 'desc'>>}
          openModal={openModal as any}
          closeModal={closeModal as any}
          setSelectedCharge={setSelectedCharge}
          scrollRef={allChargesScrollRef}
          isNative={isNative}
        />
      </Suspense>
    );
  }

  // Main Dashboard Layout
  return (
    <>
      <GlobalListeners activeTab={activeTab} />
      <MainLayout
        layoutMode={layoutMode || undefined}
        isCompact={isCompact}
        activeTab={activeTab}
        tabs={tabs}
        handleTabClick={handleTabClick}
        isTransitioning={isTransitioning}
        fadingTab={fadingTab}
        backgroundLoad={backgroundLoad}
        onTripSelect={openTripDetail}
        onChargeSelect={handleChargeSelect}
        setSwipeContainer={setSwipeContainer}
      />
    </>
  );
}
