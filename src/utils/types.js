// BYD Stats - Type Definitions (JSDoc)
// This file contains all shared type definitions for IDE support and documentation.
// Import with: @typedef {import('./types').Trip} Trip

/**
 * @typedef {Object} Trip
 * @property {string} id - Unique identifier (usually start_timestamp)
 * @property {string} date - Date in YYYYMMDD format
 * @property {number} trip - Distance in km
 * @property {number} electricity - Energy consumed in kWh
 * @property {number} duration - Duration in minutes
 * @property {number} start_timestamp - Unix timestamp of trip start
 * @property {number} end_timestamp - Unix timestamp of trip end
 * @property {string} [month] - Month string for filtering (YYYYMM)
 * @property {number} [start_soc] - Starting battery percentage
 * @property {number} [end_soc] - Ending battery percentage
 * @property {number} [avg_speed] - Average speed in km/h
 * @property {number} [max_speed] - Maximum speed in km/h
 * @property {number} [regeneration] - Energy regenerated in kWh
 */

/**
 * @typedef {Object} Charge
 * @property {string} id - Unique identifier
 * @property {string} date - Date in YYYYMMDD format
 * @property {string} time - Time in HH:MM format
 * @property {number} kwhCharged - Energy charged in kWh
 * @property {number} totalCost - Total cost in currency
 * @property {number} pricePerKwh - Price per kWh
 * @property {string} chargerTypeId - ID of the charger type used
 * @property {number} [initialPercentage] - Starting battery percentage
 * @property {number} [finalPercentage] - Final battery percentage
 * @property {number} [odometer] - Odometer reading in km
 * @property {string} [notes] - Optional notes
 */

/**
 * @typedef {Object} ChargerType
 * @property {string} id - Unique identifier (e.g., 'home', 'public_ac', 'csv_123')
 * @property {string} name - Display name
 * @property {string} [icon] - Icon identifier
 * @property {number} [defaultPrice] - Default price per kWh for this charger
 * @property {number} [efficiency] - Charging efficiency percentage (0-100)
 */

/**
 * @typedef {Object} Settings
 * @property {string} [carModel] - Car model name
 * @property {string} [licensePlate] - License plate number
 * @property {number} batterySize - Battery capacity in kWh (default: 60.48)
 * @property {number} [soh] - State of Health percentage (0-100)
 * @property {number} electricityPrice - Electricity price per kWh
 * @property {'custom'|'calculated'} [priceMode] - Price mode
 * @property {'es'|'en'} language - Language code
 * @property {'auto'|'dark'|'light'} theme - Theme preference
 * @property {ChargerType[]} chargerTypes - Array of charger type definitions
 */

/**
 * @typedef {Object} GoogleSyncState
 * @property {boolean} isLoggedIn - Whether user is logged into Google
 * @property {boolean} isSyncing - Whether sync is in progress
 * @property {string|null} lastSync - ISO timestamp of last successful sync
 * @property {Object|null} userProfile - Google user profile data
 * @property {Object|null} pendingConflict - Conflict awaiting resolution
 * @property {Function} login - Login function
 * @property {Function} logout - Logout function
 * @property {Function} syncNow - Trigger sync function
 * @property {Function} resolveConflict - Resolve pending conflict
 * @property {Function} dismissConflict - Dismiss pending conflict
 */

/**
 * @typedef {Object} Summary
 * @property {number} totalKm - Total distance traveled
 * @property {number} totalKwh - Total energy consumed
 * @property {number} totalDuration - Total time in minutes
 * @property {number} avgEfficiency - Average kWh/100km
 * @property {number} avgSpeed - Average speed in km/h
 * @property {number} tripCount - Number of trips
 * @property {number} activeDays - Number of unique driving days
 * @property {number} minEfficiency - Minimum efficiency value
 * @property {number} maxEfficiency - Maximum efficiency value
 */

/**
 * @typedef {Object} MonthlyData
 * @property {string} month - Month label (e.g., "Jan 2024")
 * @property {number} km - Total km for month
 * @property {number} kwh - Total kWh for month
 * @property {number} trips - Trip count for month
 */

/**
 * @typedef {Object} ProcessedData
 * @property {Summary} summary - Aggregated statistics
 * @property {MonthlyData[]} monthly - Monthly aggregated data
 * @property {Object[]} daily - Daily aggregated data
 * @property {Object[]} hourly - Hourly trip distribution
 * @property {Object[]} weekday - Weekday trip distribution
 * @property {Object[]} tripDist - Trip distance distribution buckets
 * @property {Object[]} effScatter - Efficiency scatter plot data
 * @property {Object} top - Top records (distance, consumption, duration)
 */

/**
 * @typedef {Object} ModalState
 * @property {boolean} upload - Upload modal visibility
 * @property {boolean} filter - Filter modal visibility
 * @property {boolean} allTrips - All trips view visibility
 * @property {boolean} allCharges - All charges view visibility
 * @property {boolean} tripDetail - Trip detail modal visibility
 * @property {boolean} settings - Settings modal visibility
 * @property {boolean} history - History/database modal visibility
 * @property {boolean} help - Help modal visibility
 * @property {boolean} legal - Legal modal visibility
 * @property {boolean} addCharge - Add/edit charge modal visibility
 * @property {boolean} chargeDetail - Charge detail modal visibility
 */

// Export empty object to make this a valid module
export { };
