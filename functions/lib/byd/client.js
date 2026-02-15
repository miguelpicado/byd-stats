"use strict";
/**
 * BYD API Client
 * Ported from pyBYD (https://github.com/jkaberg/pyBYD)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BydClient = void 0;
const crypto = __importStar(require("crypto"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const crypto_1 = require("./crypto");
// =============================================================================
// CONSTANTS
// =============================================================================
const BASE_URL = 'https://dilinkappoversea-eu.byd.auto';
const USER_AGENT = 'okhttp/4.12.0';
// Default device info (simulates Android app) - matches pyBYD values exactly
const DEFAULT_DEVICE = {
    // Device profile fields
    ostype: 'and',
    imei: 'BANGCLE01234',
    mac: '00:00:00:00:00:00',
    model: 'POCO F1',
    sdk: '35',
    mod: 'Xiaomi',
    imeiMD5: '00000000000000000000000000000000',
    mobileBrand: 'XIAOMI',
    mobileModel: 'POCO F1',
    deviceType: '0',
    networkType: 'wifi',
    osType: '15', // This is different from ostype!
    osVersion: '35',
    // Config fields
    appVersion: '3.2.2',
    appInnerVersion: '322',
    timeZone: 'Europe/Madrid',
    softType: '0',
    tboxVersion: '3',
    isAuto: '1',
    language: 'en',
};
// Session expired codes - includes 1002 (logged in from another device)
const SESSION_EXPIRED_CODES = ['1002', '1005', '1010'];
// =============================================================================
// BYD CLIENT
// =============================================================================
class BydClient {
    constructor(config) {
        this.session = null;
        this.cookies = {};
        this.reloginPromise = null;
        this.config = config;
        this.device = Object.assign(Object.assign({}, DEFAULT_DEVICE), config.device);
    }
    /**
     * Restore session from stored data (avoids calling login which creates new tokens)
     * Use this to share session between MQTT listener and Firebase functions
     */
    restoreSession(sessionData) {
        this.session = {
            token: {
                userId: sessionData.userId,
                signToken: sessionData.signToken,
                encryToken: sessionData.encryToken,
            },
            cookies: sessionData.cookies || {},
        };
        this.cookies = sessionData.cookies || {};
    }
    /**
     * Get current session (for storing/sharing)
     */
    getSession() {
        return this.session;
    }
    /**
     * Check if we have a valid session
     */
    hasSession() {
        return this.session !== null;
    }
    // =========================================================================
    // AUTHENTICATION
    // =========================================================================
    /**
     * Login to BYD API and get session token
     * Exact port of pyBYD build_login_request / parse_login_response
     */
    async login() {
        const nowMs = Date.now();
        const serviceTime = String(nowMs);
        const reqTimestamp = String(nowMs);
        const randomHex = crypto.randomBytes(16).toString('hex').toUpperCase();
        // Build inner payload - EXACT match to pyBYD
        const inner = {
            appInnerVersion: this.device.appInnerVersion,
            appVersion: this.device.appVersion,
            deviceName: `${this.device.mobileBrand}${this.device.mobileModel}`,
            deviceType: this.device.deviceType,
            imeiMD5: this.device.imeiMD5,
            isAuto: this.device.isAuto,
            mobileBrand: this.device.mobileBrand,
            mobileModel: this.device.mobileModel,
            networkType: this.device.networkType,
            osType: this.device.osType, // "15" for login inner
            osVersion: this.device.osVersion,
            random: randomHex,
            softType: this.device.softType,
            timeStamp: reqTimestamp,
            timeZone: this.device.timeZone,
        };
        // Encrypt inner data with compact JSON (no spaces)
        const loginKey = (0, crypto_1.pwdLoginKey)(this.config.password);
        const innerJson = JSON.stringify(inner); // No separators needed, default is compact
        const encryData = (0, crypto_1.aesEncryptHex)(innerJson, loginKey);
        // Build sign fields - includes additional fields not in inner
        const passwordMD5 = (0, crypto_1.md5Hex)(this.config.password);
        const signFields = Object.assign(Object.assign({}, inner), { countryCode: this.config.countryCode, functionType: 'pwdLogin', identifier: this.config.username, identifierType: '0', language: this.device.language, reqTimestamp: reqTimestamp });
        const signString = (0, crypto_1.buildSignString)(signFields, passwordMD5);
        const sign = (0, crypto_1.sha1Mixed)(signString);
        // Build outer payload - EXACT match to pyBYD
        const outer = {
            countryCode: this.config.countryCode,
            encryData,
            functionType: 'pwdLogin',
            identifier: this.config.username,
            identifierType: '0',
            imeiMD5: this.device.imeiMD5,
            isAuto: this.device.isAuto,
            language: this.device.language,
            reqTimestamp: reqTimestamp,
            sign,
            signKey: this.config.password, // IMPORTANT: plaintext password, not randomHex!
            // Common outer fields from device profile
            ostype: this.device.ostype, // "and" for outer
            imei: this.device.imei,
            mac: this.device.mac,
            model: this.device.model,
            sdk: this.device.sdk,
            mod: this.device.mod,
            serviceTime: serviceTime,
        };
        outer.checkcode = (0, crypto_1.computeCheckcode)(outer);
        // Make request
        const response = await this.postSecure('/app/account/login', outer);
        // Parse response
        if (response.code !== '0') {
            throw new Error(`Login failed: code=${response.code} message=${response.message || response.msg || ''}`);
        }
        if (!response.respondData) {
            throw new Error('Login failed: no respondData');
        }
        // Decrypt response data
        const decrypted = (0, crypto_1.aesDecryptUtf8)(response.respondData, loginKey);
        const innerResponse = JSON.parse(decrypted);
        // Token is nested inside 'token' object in pyBYD
        const tokenData = innerResponse.token || innerResponse;
        if (!tokenData.userId || !tokenData.signToken || !tokenData.encryToken) {
            throw new Error('Login failed: invalid token data');
        }
        const token = {
            userId: String(tokenData.userId),
            signToken: String(tokenData.signToken),
            encryToken: String(tokenData.encryToken),
        };
        this.session = {
            token,
            cookies: Object.assign({}, this.cookies),
        };
        return token;
    }
    /**
     * Ensure we have a valid session
     */
    async ensureSession() {
        if (!this.session) {
            await this.login();
        }
        return this.session;
    }
    // =========================================================================
    // VEHICLES
    // =========================================================================
    /**
     * Get list of vehicles for the account
     * pyBYD: build_list_request with specific inner fields
     */
    async getVehicles() {
        var _a;
        await this.ensureSession();
        const nowMs = Date.now();
        const randomHex = crypto.randomBytes(16).toString('hex').toUpperCase();
        // Inner payload must have these specific fields per pyBYD
        const inner = {
            deviceType: this.device.deviceType,
            imeiMD5: this.device.imeiMD5,
            networkType: this.device.networkType,
            random: randomHex,
            timeStamp: String(nowMs),
            version: this.device.appInnerVersion,
        };
        const response = await this.postAuthenticatedJson('/app/account/getAllListByUserId', inner, true);
        if (response.code !== '0') {
            throw new Error(`Failed to get vehicles: ${response.msg || response.code}`);
        }
        // Log the full response to see the structure
        console.log(`[getVehicles] Full response: ${JSON.stringify(response)}`);
        console.log(`[getVehicles] response.data: ${JSON.stringify(response.data)}`);
        // response.data can be the array directly or have a vehicleList property
        const vehicleList = Array.isArray(response.data) ? response.data : (((_a = response.data) === null || _a === void 0 ? void 0 : _a.vehicleList) || []);
        console.log(`[getVehicles] vehicleList count: ${vehicleList.length}`);
        return vehicleList.map((v) => {
            var _a, _b;
            return ({
                vin: v.vin,
                vehicleId: v.vehicleId || ((_a = v.empowerId) === null || _a === void 0 ? void 0 : _a.toString()),
                vehicleType: v.vehicleType || ((_b = v.carType) === null || _b === void 0 ? void 0 : _b.toString()),
                vehicleName: v.autoAlias || v.vehicleName,
                brandName: v.brandName,
                modelName: v.modelName,
                plateNo: v.autoPlate || v.plateNo,
            });
        });
    }
    // =========================================================================
    // REALTIME DATA (with polling)
    // =========================================================================
    /**
     * Get realtime vehicle data
     */
    async getRealtime(vin) {
        // Trigger request
        const triggerResponse = await this.postAuthenticatedJson('/vehicleInfo/vehicle/vehicleRealTimeRequest', { vin });
        if (triggerResponse.code !== '0') {
            throw new Error(`Failed to trigger realtime: ${triggerResponse.msg}`);
        }
        // Poll for result
        const result = await this.pollForResult('/vehicleInfo/vehicle/vehicleRealTimeResult', { vin }, 5, 2000);
        return this.parseRealtimeData(result);
    }
    parseRealtimeData(data) {
        const info = data.vehicleStatus || data;
        // Try multiple field names - BYD uses different names in different regions/versions
        const soc = this.parseNumber(info.elecPercent || info.fuelTankCurrentSOC || info.soc, 0);
        const range = this.parseNumber(info.evEndurance || info.EVTravelableRangeKm || info.range, 0);
        const odometer = this.parseNumber(info.odo || info.mileage || info.odometerMileage, 0);
        // Detect offline state: if all key values are 0, car is likely asleep
        const isOffline = soc === 0 && range === 0 && odometer === 0;
        return {
            soc,
            range,
            odometer,
            speed: this.parseNumber(info.speed),
            isCharging: info.chargeState === 1 || info.chargeStatus === '1' || info.isCharging === true,
            isLocked: info.lockState === '2' || info.doorLockState === '2',
            isOnline: !isOffline && (info.onlineStatus === '1' || info.isOnline === true),
            exteriorTemp: this.parseNumber(info.exteriorTemperature),
            interiorTemp: this.parseNumber(info.interiorTemperature),
            doors: {
                frontLeft: info.driverDoorState === '2',
                frontRight: info.passengerDoorState === '2',
                rearLeft: info.rearLeftDoorState === '2',
                rearRight: info.rearRightDoorState === '2',
                trunk: info.trunkState === '2',
                hood: info.hoodState === '2',
            },
            windows: {
                frontLeft: info.driverWindowState === '1',
                frontRight: info.passengerWindowState === '1',
                rearLeft: info.rearLeftWindowState === '1',
                rearRight: info.rearRightWindowState === '1',
            },
            raw: data,
        };
    }
    // =========================================================================
    // GPS LOCATION (with polling)
    // =========================================================================
    /**
     * Get GPS location
     */
    async getGps(vin) {
        // Trigger request
        const triggerResponse = await this.postAuthenticatedJson('/control/getGpsInfo', { vin });
        if (triggerResponse.code !== '0') {
            throw new Error(`Failed to trigger GPS: ${triggerResponse.msg}`);
        }
        // Poll for result
        const result = await this.pollForResult('/control/getGpsInfoResult', { vin }, 5, 2000);
        return this.parseGpsData(result);
    }
    parseGpsData(data) {
        return {
            latitude: this.parseNumber(data.latitude, 0),
            longitude: this.parseNumber(data.longitude, 0),
            heading: this.parseNumber(data.heading),
            speed: this.parseNumber(data.speed),
            timestamp: data.timestamp ? parseInt(data.timestamp, 10) : undefined,
            raw: data,
        };
    }
    // =========================================================================
    // CHARGING STATUS
    // =========================================================================
    /**
     * Get charging status
     */
    async getChargingStatus(vin) {
        const response = await this.postAuthenticatedJson('/control/smartCharge/homePage', { vin });
        if (response.code !== '0') {
            throw new Error(`Failed to get charging: ${response.msg}`);
        }
        const data = response.data || {};
        return {
            soc: this.parseNumber(data.soc || data.currentSoc, 0),
            isCharging: data.chargeStatus === '1' || data.isCharging === true,
            chargeType: data.chargeType,
            remainingMinutes: this.parseNumber(data.remainingTime),
            targetSoc: this.parseNumber(data.targetSoc),
            scheduledCharging: data.timedChargeStatus === '1',
            raw: data,
        };
    }
    // =========================================================================
    // MQTT BROKER INFO
    // =========================================================================
    /**
     * Get MQTT broker connection info
     * Used by external MQTT listeners (e.g., Raspberry Pi)
     */
    async getEmqBrokerInfo() {
        await this.ensureSession();
        const nowMs = Date.now();
        const randomHex = crypto.randomBytes(16).toString('hex').toUpperCase();
        // Inner payload must have these specific fields per pyBYD
        const inner = {
            deviceType: this.device.deviceType,
            imeiMD5: this.device.imeiMD5,
            networkType: this.device.networkType,
            random: randomHex,
            timeStamp: String(nowMs),
            version: this.device.appInnerVersion,
        };
        try {
            const response = await this.postAuthenticatedJson('/app/emqAuth/getEmqBrokerIp', inner, true // rawInner = true, don't add reqTimestamp
            );
            console.log('[getEmqBrokerInfo] Response:', JSON.stringify(response).substring(0, 500));
            if (response.code !== '0' || !response.data) {
                console.log('[getEmqBrokerInfo] No broker info available, code:', response.code);
                return null;
            }
            // Parse broker URL (format: "hostname:port" or just "hostname")
            // Note: BYD API returns "emqBorker" (with typo, missing 'r')
            const brokerStr = response.data.emqBorker || response.data.emqBroker || response.data.brokerIp || response.data.broker || '';
            console.log('[getEmqBrokerInfo] Broker string:', brokerStr);
            const parts = brokerStr.split(':');
            return {
                host: parts[0] || 'emqoversea-eu.byd.auto',
                port: parseInt(parts[1], 10) || 8883,
            };
        }
        catch (error) {
            console.error('[getEmqBrokerInfo] Error:', error);
            return null;
        }
    }
    // =========================================================================
    // REMOTE CONTROL
    // =========================================================================
    /**
     * Lock vehicle
     */
    async lock(vin, pin) {
        return this.remoteControl(vin, 'LOCK', pin);
    }
    /**
     * Unlock vehicle
     */
    async unlock(vin, pin) {
        return this.remoteControl(vin, 'UNLOCK', pin);
    }
    /**
     * Flash lights
     */
    async flashLights(vin, pin) {
        return this.remoteControl(vin, 'FLASH_LIGHTS', pin);
    }
    /**
     * Honk horn
     */
    async honkHorn(vin, pin) {
        return this.remoteControl(vin, 'FIND_CAR', pin);
    }
    /**
     * Start climate
     */
    async startClimate(vin, tempCelsius = 22, pin) {
        // BYD uses scale 1-17 where 1=18°C, 17=32°C
        const bydTemp = Math.max(1, Math.min(17, tempCelsius - 17));
        const params = {
            mainSettingTemp: String(bydTemp),
            copilotSettingTemp: String(bydTemp),
            cycleMode: '2', // Fresh air
            timeSpan: '15', // 15 minutes
        };
        return this.remoteControl(vin, 'START_CLIMATE', pin, params);
    }
    /**
     * Stop climate
     */
    async stopClimate(vin, pin) {
        return this.remoteControl(vin, 'STOP_CLIMATE', pin);
    }
    /**
     * Close windows
     */
    async closeWindows(vin, pin) {
        return this.remoteControl(vin, 'CLOSE_WINDOWS', pin);
    }
    /**
     * Control seat climate/heating
     * @param vin Vehicle VIN
     * @param seat Seat position (0=driver, 1=passenger)
     * @param mode Heat level (0=off, 1=low, 2=medium, 3=high)
     * @param pin Control PIN
     */
    async seatClimate(vin, seat, mode, pin) {
        const params = {
            seatNum: String(seat), // 0=driver, 1=passenger
            level: String(mode), // 0=off, 1=low, 2=medium, 3=high
        };
        return this.remoteControl(vin, 'SEAT_CLIMATE', pin, params);
    }
    /**
     * Control battery heating
     */
    async batteryHeat(vin, pin) {
        return this.remoteControl(vin, 'BATTERY_HEAT', pin);
    }
    async remoteControl(vin, command, pin, params) {
        const controlPin = pin || this.config.controlPin;
        if (!controlPin) {
            throw new Error('Control PIN required for remote commands');
        }
        // Hash PIN if not already hashed - BYD expects lowercase MD5 for control PIN
        const pinHash = controlPin.length === 32 ? controlPin.toLowerCase() : (0, crypto_1.md5HexLower)(controlPin);
        // Verify PIN first
        await this.verifyControlPin(vin, pinHash);
        // Command codes
        const commandCodes = {
            'LOCK': '1',
            'UNLOCK': '2',
            'FLASH_LIGHTS': '3',
            'FIND_CAR': '4',
            'START_CLIMATE': '5',
            'STOP_CLIMATE': '6',
            'CLOSE_WINDOWS': '7',
            'SEAT_CLIMATE': '8',
            'BATTERY_HEAT': '9',
        };
        const controlType = commandCodes[command];
        if (!controlType) {
            throw new Error(`Unknown command: ${command}`);
        }
        // Trigger command
        const payload = {
            vin,
            controlType,
            controlPassword: pinHash,
        };
        if (params) {
            payload.controlParamsMap = params;
        }
        const triggerResponse = await this.postAuthenticatedJson('/control/remoteControl', payload);
        if (triggerResponse.code !== '0') {
            throw new Error(`Remote control failed: ${triggerResponse.msg}`);
        }
        // Poll for result
        const result = await this.pollForResult('/control/remoteControlResult', { vin, controlType }, 10, 3000);
        return result.controlState === '1';
    }
    async verifyControlPin(vin, pinHash) {
        const response = await this.postAuthenticatedJson('/vehicle/vehicleswitch/verifyControlPassword', { vin, controlPassword: pinHash });
        if (response.code === '6024') {
            throw new Error('Rate limited - please wait before retrying');
        }
        if (response.code !== '0') {
            throw new Error(`PIN verification failed: ${response.msg}`);
        }
    }
    // =========================================================================
    // HTTP TRANSPORT
    // =========================================================================
    /**
     * Make authenticated request with encrypted envelope
     * @param endpoint API endpoint
     * @param payload Inner payload data
     * @param rawInner If true, use payload as-is without adding reqTimestamp
     */
    async postAuthenticatedJson(endpoint, payload, rawInner = false, _isRetry = false) {
        const session = await this.ensureSession();
        const nowMs = Date.now();
        // Build inner payload
        const inner = rawInner ? payload : Object.assign(Object.assign({}, payload), { reqTimestamp: String(nowMs) });
        // Use the same timestamp as inner for consistency
        // If rawInner, use inner's timeStamp; otherwise use nowMs
        const reqTimestamp = rawInner && payload.timeStamp ? payload.timeStamp : String(nowMs);
        // Encrypt inner data - encryToken must be MD5 hashed to get the AES key
        // pyBYD: "decrypts payloads using MD5(encryToken) + AES-128-CBC (zero IV)"
        const contentKey = (0, crypto_1.md5Hex)(session.token.encryToken);
        console.log(`[postAuthenticatedJson] endpoint: ${endpoint}`);
        console.log(`[postAuthenticatedJson] encryToken: ${session.token.encryToken.substring(0, 10)}...`);
        console.log(`[postAuthenticatedJson] contentKey (MD5): ${contentKey}`);
        console.log(`[postAuthenticatedJson] inner: ${JSON.stringify(inner)}`);
        console.log(`[postAuthenticatedJson] reqTimestamp: ${reqTimestamp}`);
        const encryData = (0, crypto_1.aesEncryptHex)(JSON.stringify(inner), contentKey);
        // Build sign string - pyBYD: inner payload + countryCode, identifier, imeiMD5, language, reqTimestamp
        // IMPORTANT: sign_key = MD5(signToken), not signToken directly!
        const signKey = (0, crypto_1.md5Hex)(session.token.signToken);
        const signFields = Object.assign(Object.assign({}, inner), { countryCode: this.config.countryCode, identifier: session.token.userId, imeiMD5: this.device.imeiMD5, language: this.device.language, reqTimestamp });
        const signString = (0, crypto_1.buildSignString)(signFields, signKey);
        console.log(`[postAuthenticatedJson] signKey (MD5 of signToken): ${signKey}`);
        console.log(`[postAuthenticatedJson] signFields: ${JSON.stringify(signFields)}`);
        console.log(`[postAuthenticatedJson] signString: ${signString.substring(0, 100)}...`);
        const sign = (0, crypto_1.sha1Mixed)(signString);
        console.log(`[postAuthenticatedJson] sign: ${sign}`);
        // Build outer payload - MUST match pyBYD field order for checkcode
        const outer = {
            countryCode: this.config.countryCode,
            encryData,
            identifier: session.token.userId,
            imeiMD5: this.device.imeiMD5,
            language: this.device.language,
            reqTimestamp,
            sign,
            ostype: this.device.ostype,
            imei: this.device.imei,
            mac: this.device.mac,
            model: this.device.model,
            sdk: this.device.sdk,
            mod: this.device.mod,
            serviceTime: reqTimestamp, // Use same timestamp
        };
        outer.checkcode = (0, crypto_1.computeCheckcode)(outer);
        console.log(`[postAuthenticatedJson] outer (no encryData): ${JSON.stringify(Object.assign(Object.assign({}, outer), { encryData: '...' }))}`);
        // Make request
        const response = await this.postSecure(endpoint, outer);
        console.log(`[postAuthenticatedJson] response code: ${response.code}, msg: ${response.msg || response.message || ''}`);
        // Check for session expiration (1002=another device login, 1005/1010=expired)
        if (SESSION_EXPIRED_CODES.includes(response.code)) {
            this.session = null;
            // Auto-retry once with a fresh login (serialized to prevent concurrent relogins)
            if (!_isRetry) {
                console.log(`[postAuthenticatedJson] Session expired (code ${response.code}), re-logging in and retrying...`);
                if (!this.reloginPromise) {
                    this.reloginPromise = this.login().then(() => {
                        this.reloginPromise = null;
                    }).catch((err) => {
                        this.reloginPromise = null;
                        throw err;
                    });
                }
                await this.reloginPromise;
                return this.postAuthenticatedJson(endpoint, payload, rawInner, true);
            }
            throw new Error('Session expired');
        }
        // Decrypt response if present (field is 'respondData', not 'encryData')
        if (response.respondData) {
            const decrypted = (0, crypto_1.aesDecryptUtf8)(response.respondData, contentKey);
            console.log(`[postAuthenticatedJson] Decrypted respondData: ${decrypted.substring(0, 200)}...`);
            // Handle empty or whitespace-only responses
            if (decrypted && decrypted.trim()) {
                response.data = JSON.parse(decrypted);
            }
            else {
                console.log(`[postAuthenticatedJson] Warning: empty decrypted response`);
                response.data = null;
            }
        }
        return response;
    }
    /**
     * Make request through Bangcle secure transport
     */
    async postSecure(endpoint, payload) {
        if (!(0, crypto_1.areBangcleTablesLoaded)()) {
            throw new Error('Bangcle tables not loaded. Call loadBangcleTables() first.');
        }
        const url = BASE_URL + endpoint;
        const encoded = (0, crypto_1.encodeEnvelope)(JSON.stringify(payload));
        const headers = {
            'accept-encoding': 'identity',
            'content-type': 'application/json; charset=UTF-8',
            'user-agent': USER_AGENT,
        };
        if (Object.keys(this.cookies).length > 0) {
            headers['cookie'] = Object.entries(this.cookies)
                .map(([k, v]) => `${k}=${v}`)
                .join('; ');
        }
        const response = await (0, node_fetch_1.default)(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ request: encoded }),
        });
        // Update cookies
        const setCookie = response.headers.get('set-cookie');
        if (setCookie) {
            this.parseCookies(setCookie);
        }
        const bodyText = await response.text();
        let body;
        try {
            body = JSON.parse(bodyText);
        }
        catch (e) {
            throw new Error(`Server returned non-JSON response: ${bodyText.substring(0, 500)}`);
        }
        if (!body.response) {
            // Check if this is an error response
            if (body.code || body.msg || body.message) {
                throw new Error(`Server error: code=${body.code}, msg=${body.msg || body.message}`);
            }
            throw new Error(`Invalid response: missing response field. Body: ${bodyText.substring(0, 500)}`);
        }
        const decoded = (0, crypto_1.decodeEnvelope)(body.response);
        try {
            return JSON.parse(decoded);
        }
        catch (e) {
            throw new Error(`Failed to parse decoded response as JSON. Decoded: ${decoded.substring(0, 500)}`);
        }
    }
    /**
     * Poll for async result
     */
    async pollForResult(endpoint, payload, maxAttempts, delayMs) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            if (attempt > 0) {
                await this.sleep(delayMs);
            }
            const response = await this.postAuthenticatedJson(endpoint, payload);
            if (response.code === '0' && response.data) {
                return response.data;
            }
            // Still processing
            if (response.code === '1002' || response.code === '1003') {
                continue;
            }
            // Vehicle offline/not responding
            if (response.code === '1009') {
                throw new Error('Vehicle offline - car may be asleep. Try again when the car is awake (driving, charging, or recently used).');
            }
            // Error
            if (response.code !== '0') {
                throw new Error(`Poll failed: ${response.msg || response.code}`);
            }
        }
        throw new Error('Polling timeout');
    }
    // =========================================================================
    // UTILITIES
    // =========================================================================
    parseCookies(setCookie) {
        const parts = setCookie.split(',');
        for (const part of parts) {
            const [cookie] = part.split(';');
            const [name, value] = cookie.trim().split('=');
            if (name && value) {
                this.cookies[name] = value;
            }
        }
    }
    parseNumber(value, defaultValue) {
        if (value === null || value === undefined || value === '') {
            return defaultValue;
        }
        const num = typeof value === 'string' ? parseFloat(value) : value;
        return isNaN(num) ? defaultValue : num;
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.BydClient = BydClient;
//# sourceMappingURL=client.js.map