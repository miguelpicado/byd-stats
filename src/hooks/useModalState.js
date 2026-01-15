// BYD Stats - Modal State Management Hook
import { useState, useCallback, useMemo } from 'react';

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
    legal: false,
    addCharge: false,
    chargeDetail: false
  });

  // Track additional modal-related state
  const [legalInitialSection, setLegalInitialSection] = useState('privacy');

  /**
   * Open a specific modal
   * @param {string} name - Modal name to open
   */
  const openModal = useCallback((name) => {
    setModals(prev => ({ ...prev, [name]: true }));
  }, []);

  /**
   * Close a specific modal
   * @param {string} name - Modal name to close
   */
  const closeModal = useCallback((name) => {
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
      legal: false,
      addCharge: false,
      chargeDetail: false
    });
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
    // Convenience boolean getters for common checks
    isAnyModalOpen: Object.values(modals).some(Boolean)
  }), [modals, openModal, closeModal, toggleModal, closeAllModals, openLegalModal, legalInitialSection]);

  return value;
};

export default useModalState;
