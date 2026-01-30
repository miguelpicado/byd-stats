// BYD Stats - Modal State Management Hook
import { useState, useCallback, useMemo, useEffect } from 'react';

/**
 * Hook to manage all modal states in a centralized way
 * Reduces the number of useState calls and provides consistent modal management
 * @returns {Object} Modal state and control functions
 */
const useModalState = () => {
  const [modals, setModals] = useState({
    upload: false,
    filter: false,
    allTrips: false,
    allCharges: false,
    tripDetail: false,
    settings: false,
    history: false,
    help: false,
    addCharge: false,
    chargeDetail: false,
    backups: false,
    registryRestore: false,
    registryCars: [] // Prop to pass data to modal
  });

  // Track additional modal-related state
  const [legalInitialSection, setLegalInitialSection] = useState('privacy');

  // Selected items for detail modals
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [selectedCharge, setSelectedCharge] = useState(null);
  const [editingCharge, setEditingCharge] = useState(null);

  // Sync Hash on mount and hash change (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const hash = window.location.hash;
      const showAllTrips = hash === '#all-trips';
      const showAllCharges = hash === '#all-charges';

      setModals(prev => {
        // Only trigger update if state actually changes to avoid loops
        if (prev.allTrips === showAllTrips && prev.allCharges === showAllCharges) return prev;

        return {
          ...prev,
          allTrips: showAllTrips,
          allCharges: showAllCharges
        };
      });
    };

    // Check on mount
    handlePopState();

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  /**
   * Open a specific modal
   * @param {string} name - Modal name to open
   */
  const openModal = useCallback((name) => {
    // History handling for specific modals
    if (name === 'allTrips') {
      if (window.location.hash !== '#all-trips') window.history.pushState(null, '', '/#all-trips');
    } else if (name === 'allCharges') {
      if (window.location.hash !== '#all-charges') window.history.pushState(null, '', '/#all-charges');
    }

    setModals(prev => ({ ...prev, [name]: true }));
  }, []);

  /**
   * Close a specific modal
   * @param {string} name - Modal name to close
   */
  const closeModal = useCallback((name) => {
    // History handling for specific modals
    if ((name === 'allTrips' && window.location.hash === '#all-trips') ||
      (name === 'allCharges' && window.location.hash === '#all-charges')) {
      window.history.back();
      // State update happens in popstate listener, but we can optimistically set it here too
      // However, standard flow relies on popstate. 
      // Force closing just in case back doesn't fire immediately or is blocked?
      // Better to let the logic flow naturally. But if history stack is weird, might fail.
      // Let's rely on history.back() triggering popstate for clean nav.
      // If we force setModals(false) here, and THEN popstate fires, it's redundant but safe.
    }

    setModals(prev => ({ ...prev, [name]: false }));
  }, []);

  /**
   * Toggle a specific modal
   * @param {string} name - Modal name to toggle
   */
  const toggleModal = useCallback((name) => {
    setModals(prev => ({ ...prev, [name]: !prev[name] }));
  }, []);

  /**
   * Close all modals at once
   */
  const closeAllModals = useCallback(() => {
    setModals({
      upload: false,
      filter: false,
      allTrips: false,
      allCharges: false,
      tripDetail: false,
      settings: false,
      history: false,
      help: false,
      addCharge: false,
      chargeDetail: false,
      backups: false,
      registryRestore: false,
      registryCars: []
    });
    setSelectedTrip(null);
    setSelectedCharge(null);
    setEditingCharge(null);
  }, []);

  /**
   * Open registry restore modal
   */
  const openRegistryModal = useCallback((cars) => {
    setModals(prev => ({ ...prev, registryRestore: true, registryCars: cars }));
  }, []);

  /**
   * Close registry restore modal
   */
  const closeRegistryModal = useCallback(() => {
    setModals(prev => ({ ...prev, registryRestore: false, registryCars: [] }));
  }, []);

  /**
   * Open legal modal with a specific section
   * @param {string} section - Initial section to show ('privacy', 'terms', etc.)
   */
  const openLegalModal = useCallback((section = 'privacy') => {
    setLegalInitialSection(section);
    setModals(prev => ({ ...prev, legal: true }));
  }, []);

  // Memoize the return value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    modals,
    openModal,
    closeModal,
    toggleModal,
    closeAllModals,
    openLegalModal,
    legalInitialSection,
    setLegalInitialSection, // Expose setter for backwards compatibility
    // Selected items for detail modals
    selectedTrip,
    setSelectedTrip,
    selectedCharge,
    setSelectedCharge,
    editingCharge,
    setEditingCharge,
    // Convenience boolean getters for common checks
    isAnyModalOpen: Object.entries(modals).some(([key, value]) => {
      if (key === 'registryCars') return false; // Skip the data prop
      return Boolean(value);
    }),
    openRegistryModal,
    closeRegistryModal
  }), [modals, openModal, closeModal, toggleModal, closeAllModals, openLegalModal, legalInitialSection, selectedTrip, selectedCharge, editingCharge, openRegistryModal, closeRegistryModal]);

  return value;
};

export default useModalState;


