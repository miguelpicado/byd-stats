// BYD Stats - Date Utilities

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/**
 * Format month string (YYYYMM) to readable format (Ene 2024)
 * @param {string} m - Month string in YYYYMM format
 * @returns {string} Formatted month string
 */
export const formatMonth = (m) => {
    if (!m || m.length < 6) return m || '';
    return MONTH_NAMES[parseInt(m.slice(4, 6), 10) - 1] + ' ' + m.slice(0, 4);
};

/**
 * Format date string (YYYYMMDD) to readable format (DD/MM/YYYY)
 * @param {string} d - Date string in YYYYMMDD format
 * @returns {string} Formatted date string
 */
export const formatDate = (d) => {
    if (!d || d.length < 8) return d || '';
    return d.slice(6, 8) + '/' + d.slice(4, 6) + '/' + d.slice(0, 4);
};

/**
 * Format timestamp to time string (HH:MM)
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} Formatted time string
 */
export const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
};

/**
 * Convert YYYYMMDD to Date object
 * @param {string} dateStr - Date string in YYYYMMDD format
 * @returns {Date|null} Date object or null
 */
export const parseDate = (dateStr) => {
    if (!dateStr || dateStr.length < 8) return null;
    const year = parseInt(dateStr.slice(0, 4), 10);
    const month = parseInt(dateStr.slice(4, 6), 10) - 1;
    const day = parseInt(dateStr.slice(6, 8), 10);
    return new Date(year, month, day);
};

/**
 * Convert Date to YYYYMMDD format
 * @param {Date} date - Date object
 * @returns {string} Date string in YYYYMMDD format
 */
export const toDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
};
