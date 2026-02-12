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
// Default device info (simulates Android app)
const DEFAULT_DEVICE = {
    brand: 'google',
    model: 'Pixel 6',
    deviceType: '1',
    imeiMD5: (0, crypto_1.md5Hex)('byd-stats-app-' + Date.now()),
    mac: '02:00:00:00:00:00',
    sdk: '33',
    osType: '1',
    osVersion: '13',
    appVersion: '1.9.0',
    appInnerVersion: '363',
    networkType: 'wifi',
    timezone: 'Europe/Madrid'
};
// Session expired codes
const SESSION_EXPIRED_CODES = ['1005', '1010'];
// =============================================================================
// BYD CLIENT
// =============================================================================
class BydClient {
    constructor(config) {
        this.session = null;
        this.cookies = {};
        this.config = config;
        this.device = Object.assign(Object.assign({}, DEFAULT_DEVICE), config.device);
    }
    // =========================================================================
    // AUTHENTICATION
    // =========================================================================
    /**
     * Login to BYD API and get session token
     */
    async login() {
        const nowMs = Date.now();
        const randomHex = crypto.randomBytes(16).toString('hex');
        // Build inner payload
        const inner = {
            deviceBrand: this.device.brand,
            deviceModel: this.device.model,
            deviceType: this.device.deviceType,
            imeiMD5: this.device.imeiMD5,
            appVersion: this.device.appVersion,
            appInnerVersion: this.device.appInnerVersion,
            networkType: this.device.networkType,
            osType: this.device.osType,
            osVersion: this.device.osVersion,
            timezone: this.device.timezone,
            randomToken: randomHex,
            reqTimestamp: String(nowMs),
        };
        // Encrypt inner data
        const loginKey = (0, crypto_1.pwdLoginKey)(this.config.password);
        const encryData = (0, crypto_1.aesEncryptHex)(JSON.stringify(inner), loginKey);
        // Build sign string
        const passwordMD5 = (0, crypto_1.md5Hex)(this.config.password);
        const signFields = Object.assign(Object.assign({}, inner), { username: this.config.username, countryCode: this.config.countryCode });
        const signString = (0, crypto_1.buildSignString)(signFields, passwordMD5);
        const sign = (0, crypto_1.sha1Mixed)(signString);
        // Build outer payload
        const outer = {
            username: this.config.username,
            countryCode: this.config.countryCode,
            language: 'en',
            encryData,
            sign,
            signKey: randomHex,
            imeiMD5: this.device.imeiMD5,
            imei: '',
            mac: this.device.mac,
            model: this.device.model,
            sdk: this.device.sdk,
            mod: this.device.model,
            ostype: this.device.osType,
        };
        outer.checkcode = (0, crypto_1.computeCheckcode)(outer);
        // Make request
        const response = await this.postSecure('/app/account/login', outer);
        // Parse response
        if (response.code !== '0') {
            throw new Error(`Login failed: ${response.msg || response.code}`);
        }
        if (!response.respondData) {
            throw new Error('Login failed: no respondData');
        }
        // Decrypt response data
        const decrypted = (0, crypto_1.aesDecryptUtf8)(response.respondData, loginKey);
        const tokenData = JSON.parse(decrypted);
        if (!tokenData.userId || !tokenData.signToken || !tokenData.encryToken) {
            throw new Error('Login failed: invalid token data');
        }
        const token = {
            userId: tokenData.userId,
            signToken: tokenData.signToken,
            encryToken: tokenData.encryToken,
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
     */
    async getVehicles() {
        var _a;
        await this.ensureSession();
        const response = await this.postAuthenticatedJson('/app/account/getAllListByUserId', {});
        if (response.code !== '0') {
            throw new Error(`Failed to get vehicles: ${response.msg || response.code}`);
        }
        const vehicleList = ((_a = response.data) === null || _a === void 0 ? void 0 : _a.vehicleList) || [];
        return vehicleList.map((v) => ({
            vin: v.vin,
            vehicleId: v.vehicleId,
            vehicleType: v.vehicleType,
            vehicleName: v.vehicleName,
            brandName: v.brandName,
            modelName: v.modelName,
            plateNo: v.plateNo,
        }));
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
        return {
            soc: this.parseNumber(info.fuelTankCurrentSOC || info.soc, 0),
            range: this.parseNumber(info.EVTravelableRangeKm || info.range, 0),
            odometer: this.parseNumber(info.odo || info.mileage || info.odometerMileage, 0),
            speed: this.parseNumber(info.speed),
            isCharging: info.chargeStatus === '1' || info.isCharging === true,
            isLocked: info.lockState === '2' || info.doorLockState === '2',
            isOnline: info.onlineStatus === '1' || info.isOnline === true,
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
    async remoteControl(vin, command, pin, params) {
        const controlPin = pin || this.config.controlPin;
        if (!controlPin) {
            throw new Error('Control PIN required for remote commands');
        }
        // Hash PIN if not already hashed
        const pinHash = controlPin.length === 32 ? controlPin : (0, crypto_1.md5Hex)(controlPin);
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
     */
    async postAuthenticatedJson(endpoint, payload) {
        const session = await this.ensureSession();
        const nowMs = Date.now();
        // Build inner payload
        const inner = Object.assign(Object.assign({}, payload), { reqTimestamp: String(nowMs) });
        // Encrypt inner data
        const contentKey = session.token.encryToken;
        const encryData = (0, crypto_1.aesEncryptHex)(JSON.stringify(inner), contentKey);
        // Build sign string
        const signFields = Object.assign(Object.assign({}, inner), { identifier: session.token.userId });
        const signString = (0, crypto_1.buildSignString)(signFields, session.token.signToken);
        const sign = (0, crypto_1.sha1Mixed)(signString);
        // Build outer payload
        const outer = {
            identifier: session.token.userId,
            encryData,
            sign,
            reqTimestamp: String(nowMs),
            imeiMD5: this.device.imeiMD5,
            imei: '',
            mac: this.device.mac,
            model: this.device.model,
            sdk: this.device.sdk,
            mod: this.device.model,
            ostype: this.device.osType,
            countryCode: this.config.countryCode,
            language: 'en',
            serviceTime: String(nowMs),
        };
        outer.checkcode = (0, crypto_1.computeCheckcode)(outer);
        // Make request
        const response = await this.postSecure(endpoint, outer);
        // Check for session expiration
        if (SESSION_EXPIRED_CODES.includes(response.code)) {
            this.session = null;
            throw new Error('Session expired');
        }
        // Decrypt response if present
        if (response.encryData) {
            const decrypted = (0, crypto_1.aesDecryptUtf8)(response.encryData, contentKey);
            response.data = JSON.parse(decrypted);
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
        const body = await response.json();
        if (!body.response) {
            throw new Error('Invalid response: missing response field');
        }
        const decoded = (0, crypto_1.decodeEnvelope)(body.response);
        return JSON.parse(decoded);
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