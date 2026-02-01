// BYD Stats - Date Utilities

// Removed i18n dependency for Worker compatibility
// Functions now accept 'locale' string argument

/**
 * Format month string (YYYYMM) to readable format (Short Month YYYY)
 * @param {string} m - Month string in YYYYMM format
 * @param {string} locale - Locale string (e.g. 'es', 'en')
 * @returns {string} Formatted month string
 */
export const formatMonth = (m: string, locale: string = 'es'): string => {
    if (!m || m.length < 6) return m || '';
    const year = parseInt(m.slice(0, 4), 10);
    const month = parseInt(m.slice(4, 6), 10) - 1;
    const date = new Date(year, month);
    // Capitalize first letter
    const formatted = date.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

/**
 * Format date string (YYYYMMDD) to readable format (DD/MM/YYYY or locale default)
 * @param {string} d - Date string in YYYYMMDD format
 * @param {string} locale - Locale string
 * @returns {string} Formatted date string
 */
export const formatDate = (d: string, locale: string = 'es'): string => {
    if (!d || d.length < 8) return d || '';
    const year = parseInt(d.slice(0, 4), 10);
    const month = parseInt(d.slice(4, 6), 10) - 1;
    const day = parseInt(d.slice(6, 8), 10);
    const date = new Date(year, month, day);
    return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/**
 * Format timestamp to time string (HH:MM)
 * @param {number} timestamp - Unix timestamp in seconds
 * @param {string} locale - Locale string
 * @returns {string} Formatted time string
 */
export const formatTime = (timestamp: number, locale: string = 'es'): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
};

/**
 * Convert YYYYMMDD to Date object
 * @param {string} dateStr - Date string in YYYYMMDD format
 * @returns {Date|null} Date object or null
 */
export const parseDate = (dateStr: string): Date | null => {
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
export const toDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
};
