// BYD Stats - Type Definitions (JSDoc)
// This file contains all shared type definitions for IDE support and documentation.
// Import with: @typedef {import('./types').Trip} Trip

/**
 * @typedef {Object} Trip
 * @property {number} trip - Distance in km
 * @property {number} electricity - Energy consumed in kWh
 * @property {number} duration - Duration in seconds
 * @property {string} date - Date in YYYYMMDD format
 * @property {number} start_timestamp - Unix timestamp of trip start
 * @property {string} [month] - Month string for filtering (YYYYMM)
 * @property {number} [is_deleted] - Deletion flag (SQLite compatibility)
 */

/**
 * @typedef {Object} Charge
 * @property {string} id - Unique identifier (timestamp)
 * @property {string} date - Date in YYYY-MM-DD HH:mm format
 * @property {number} kwh - Energy charged in kWh
 * @property {number} cost - Total cost in currency
 * @property {string} type - Charger type (home, public, etc)
 * @property {string} [carId] - ID of the car associated with this charge
 */

/**
 * @typedef {Object} Car
 * @property {string} id - Unique identifier
 * @property {string} name - Display name
 * @property {('ev'|'phev')} type - Propulsion type
 * @property {boolean} isHybrid - Whether it has an engine
 */

/**
 * @typedef {Object} AppSettings
 * @property {boolean} isHybrid - Global hybrid/fuel mode flag
 * @property {number} electricityPrice - Default price per kWh
 * @property {number} fuelPrice - Default price per liter
 * @property {string} language - ISO language code
 * @property {string} theme - 'dark' | 'light' | 'auto'
 * @property {string} [carName] - Override name for the active car
 * @property {number} [odometerOffset] - visual kilometer adjustment
 */

/**
 * @typedef {Object} Summary
 * @property {number} totalKm - Total distance
 * @property {number} totalKwh - Total energy
 * @property {number} totalDuration - Total time in seconds
 * @property {number} avgEff - Average kWh/100km
 * @property {number} avgSpeed - Average km/h
 * @property {number} tripsCount - Trip count
 * @property {number} activeDays - Unique days active
 * @property {number} stationaryKwh - Energy used in <0.5km records
 */

/**
 * @typedef {Object} ProcessedData
 * @property {Summary} summary - Aggregated statistics
 * @property {Object} dailyData - Daily buckets
 * @property {Object} monthlyData - Monthly buckets
 * @property {Object} hourlyData - Hourly distribution
 * @property {Object} weekdayData - Day of week distribution
 */

export { };

// Export empty object to make this a valid module
export { };

