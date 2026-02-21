/**
 * BYD API Client
 * Ported from pyBYD (https://github.com/jkaberg/pyBYD)
 */

import * as node_crypto from 'node:crypto';
import fetch from 'node-fetch';
import {
    md5Hex,
    sha1Mixed,
    pwdLoginKey,
    computeCheckcode,
    aesEncryptHex,
    aesDecryptUtf8,
    buildSignString,
    encodeEnvelope,
    decodeEnvelope,
    areBangcleTablesLoaded,
    compactJson
} from './crypto';

// =============================================================================
// CONSTANTS
// =============================================================================

const BASE_URL = 'https://dilinkappoversea-eu.byd.auto';
// USER_AGENT removed - using okhttp/3.12.0 in postSecure directly

// Helper to generate random MAC


// Default device info generator - using pyBYD's default values
// pyBYD uses generic/fake device identifiers that work with the API
const generateDeviceProfile = () => ({
    ostype: 'and',
    imei: 'BANGCLE01234',
    mac: '00:00:00:00:00:00',
    model: 'POCO F1',
    sdk: '35',
    mod: 'Xiaomi',
    imeiMD5: '00000000000000000000000000000000', // Will be recalculated
    mobileBrand: 'XIAOMI',
    mobileModel: 'POCO F1',
    // Config fields
    appVersion: '3.2.3',
    appInnerVersion: '323',
    timeZone: 'Europe/Madrid',
    softType: '0',
    tboxVersion: '3',
    isAuto: '1',
    language: 'en',
    deviceType: '0',
    networkType: 'wifi',
    osType: '15',
    osVersion: '35',
});

// Session expired codes
const SESSION_EXPIRED_CODES = ['1002', '1005', '1010'];

// =============================================================================
// TYPES
// =============================================================================

export interface BydConfig {
    username: string;
    password: string;
    countryCode: string;
    controlPin?: string;
    device?: Partial<ReturnType<typeof generateDeviceProfile>>;
}

export interface AuthToken {
    userId: string;
    signToken: string;
    encryToken: string;
}

export interface BydSession {
    token: AuthToken;
    cookies: Record<string, string>;
    expiresAt?: number;
}

export interface BydVehicle {
    vin: string;
    vehicleId: string;
    vehicleType: string;
    vehicleName: string;
    brandName: string;
    modelName: string;
    plateNo?: string;
}

export interface BydRealtime {
    soc: number;                    // Battery percentage 0-100
    range: number;                  // Estimated range in km
    odometer: number;               // Total km
    speed?: number;                 // Current speed km/h
    isCharging: boolean;
    isLocked: boolean;
    isOnline: boolean;
    gear?: number;                  // 1=Park, 3=Drive, 2=Reverse/Neutral (TBC), 0=Unknown
    parkingBrake?: number;          // 0=Released, -1/1=Engaged (TBC)
    interiorTemp?: number;
    doors?: {
        frontLeft: boolean;
        frontRight: boolean;
        rearLeft: boolean;
        rearRight: boolean;
        trunk: boolean;
        hood: boolean;
    };
    windows?: {
        frontLeft: boolean;
        frontRight: boolean;
        rearLeft: boolean;
        rearRight: boolean;
    };
    tirePressure?: {
        frontLeft: number;
        frontRight: number;
        rearLeft: number;
        rearRight: number;
    };
    raw?: any;                      // Raw response for debugging
}

export interface BydGps {
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
    timestamp?: number;
    raw?: any;
}

export interface BydCharging {
    soc: number;
    isCharging: boolean;
    chargeType?: string;            // AC/DC
    remainingMinutes?: number;
    targetSoc?: number;
    scheduledCharging?: boolean;
    raw?: any;
}

// =============================================================================
// BYD CLIENT
// =============================================================================

export class BydClient {
    private config: BydConfig;
    private device: ReturnType<typeof generateDeviceProfile>;
    private session: BydSession | null = null;
    private cookies: Record<string, string> = {};
    private reloginPromise: Promise<void> | null = null;

    constructor(config: BydConfig) {
        this.config = config;

        // Use provided device config or generate random one
        // IMPORTANT: We should ideally persist this per user/vehicle to avoid triggering security checks
        // For now, we generate consistent-looking ones based on username if possible, or random
        const baseDevice = generateDeviceProfile();

        // If config passed a device, merge it. Otherwise use generated.
        this.device = { ...baseDevice, ...config.device };

        // Calculate IMEI MD5 (required for BYD)
        this.device.imeiMD5 = md5Hex(this.device.imei);
    }

    /**
     * Restore session from stored data (avoids calling login which creates new tokens)
     * Use this to share session between MQTT listener and Firebase functions
     */
    restoreSession(sessionData: { userId: string; signToken: string; encryToken: string; cookies?: Record<string, string> }): void {
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
     * Set device identity to match a stored session
     */
    setDeviceProfile(imei: string, mac: string) {
        this.device.imei = imei;
        this.device.mac = mac;
        // Recalculate MD5 as it depends on IMEI
        this.device.imeiMD5 = md5Hex(imei);
    }

    /**
     * Get current device identity (for storage)
     */
    getDeviceProfile() {
        return {
            imei: this.device.imei,
            mac: this.device.mac
        };
    }

    /**
     * Get current session (for storing/sharing)
     */
    getSession(): BydSession | null {
        return this.session;
    }

    /**
     * Check if we have a valid session
     */
    hasSession(): boolean {
        return this.session !== null;
    }

    // =========================================================================
    // AUTHENTICATION
    // =========================================================================

    /**
     * Login to BYD API and get session token
     * Exact port of pyBYD build_login_request / parse_login_response
     */
    async login(): Promise<AuthToken> {
        const nowMs = Date.now();
        const serviceTime = String(nowMs);
        const reqTimestamp = String(nowMs);
        const randomHex = node_crypto.randomBytes(16).toString('hex').toUpperCase();

        // Build inner payload - EXACT match to pyBYD
        const inner: Record<string, string> = {
            appInnerVersion: this.device.appInnerVersion,
            appVersion: this.device.appVersion,
            deviceName: `${this.device.mobileBrand}${this.device.mobileModel}`,
            deviceType: this.device.deviceType,
            imeiMD5: this.device.imeiMD5,
            isAuto: this.device.isAuto,
            mobileBrand: this.device.mobileBrand,
            mobileModel: this.device.mobileModel,
            networkType: this.device.networkType,
            osType: this.device.osType,  // "15" for login inner
            osVersion: this.device.osVersion,
            random: randomHex,
            softType: this.device.softType,
            timeStamp: reqTimestamp,
            timeZone: this.device.timeZone,
        };

        // Encrypt inner data with compact JSON (no spaces)
        const loginKey = pwdLoginKey(this.config.password);
        const innerJson = JSON.stringify(inner);  // No separators needed, default is compact
        const encryData = aesEncryptHex(innerJson, loginKey);

        // Build sign fields - includes additional fields not in inner
        const passwordMD5 = md5Hex(this.config.password);
        const signFields: Record<string, string> = {
            ...inner,
            countryCode: this.config.countryCode,
            functionType: 'pwdLogin',
            identifier: this.config.username,
            identifierType: '0',
            language: this.device.language,
            reqTimestamp: reqTimestamp,
        };
        const signString = buildSignString(signFields, passwordMD5);
        const sign = sha1Mixed(signString);

        // Build outer payload - EXACT match to pyBYD
        const outer: Record<string, any> = {
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
            signKey: this.config.password,  // IMPORTANT: plaintext password, not randomHex!
            // Common outer fields from device profile
            ostype: this.device.ostype,  // "and" for outer
            imei: this.device.imei,
            mac: this.device.mac,
            model: this.device.model,
            sdk: this.device.sdk,
            mod: this.device.mod,
            serviceTime: serviceTime,
        };
        outer.checkcode = computeCheckcode(outer);

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
        const decrypted = aesDecryptUtf8(response.respondData, loginKey);
        const innerResponse = JSON.parse(decrypted);

        // Token is nested inside 'token' object in pyBYD
        const tokenData = innerResponse.token || innerResponse;

        if (!tokenData.userId || !tokenData.signToken || !tokenData.encryToken) {
            throw new Error('Login failed: invalid token data');
        }

        const token: AuthToken = {
            userId: String(tokenData.userId),
            signToken: String(tokenData.signToken),
            encryToken: String(tokenData.encryToken),
        };

        this.session = {
            token,
            cookies: { ...this.cookies },
        };

        return token;
    }

    /**
     * Ensure we have a valid session
     */
    async ensureSession(): Promise<BydSession> {
        if (!this.session) {
            await this.login();
        }
        return this.session!;
    }

    // =========================================================================
    // VEHICLES
    // =========================================================================

    /**
     * Get list of vehicles for the account
     * pyBYD: build_list_request with specific inner fields
     */
    async getVehicles(): Promise<BydVehicle[]> {
        await this.ensureSession();
        const nowMs = Date.now();
        const randomHex = node_crypto.randomBytes(16).toString('hex').toUpperCase();

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
        const vehicleList = Array.isArray(response.data) ? response.data : (response.data?.vehicleList || []);
        console.log(`[getVehicles] vehicleList count: ${vehicleList.length}`);
        return vehicleList.map((v: any) => ({
            vin: v.vin,
            vehicleId: v.vehicleId || v.empowerId?.toString(),
            vehicleType: v.vehicleType || v.carType?.toString(),
            vehicleName: v.autoAlias || v.vehicleName,
            brandName: v.brandName,
            modelName: v.modelName,
            plateNo: v.autoPlate || v.plateNo,
        }));
    }

    // =========================================================================
    // REALTIME DATA (with polling)
    // =========================================================================

    /**
     * Get realtime vehicle data
     */
    async getRealtime(vin: string): Promise<BydRealtime> {
        // Stage 1: Trigger request - wakes the car and returns cached data + requestSerial
        // MUST send full inner payload (matching BYD-re) - sending only { vin } returns zeros
        const nowMs = Date.now();
        const randomHex = node_crypto.randomBytes(16).toString('hex').toUpperCase();
        const inner = {
            deviceType: this.device.deviceType,
            energyType: '0',
            imeiMD5: this.device.imeiMD5,
            networkType: this.device.networkType,
            random: randomHex,
            tboxVersion: this.device.tboxVersion,
            timeStamp: String(nowMs),
            version: this.device.appInnerVersion,
            vin,
        };
        const triggerResponse = await this.postAuthenticatedJson(
            '/vehicleInfo/vehicle/vehicleRealTimeRequest',
            inner,
            true  // rawInner - payload already has timeStamp and all required fields
        );

        if (String(triggerResponse.code) !== '0') {
            throw new Error(`Failed to trigger realtime: code=${triggerResponse.code} msg=${triggerResponse.msg}`);
        }

        // Extract requestSerial - could be at response level or inside data
        const triggerData = triggerResponse.data || {};
        // BYD-re: requestSerial is at the same level as vehicleInfo in the decrypted response
        const requestSerial = triggerResponse.requestSerial || triggerData.requestSerial || null;
        // Check for vehicleInfo nesting (BYD-re format)
        const vehicleInfo = triggerData.vehicleInfo || triggerData.vehicleStatus || null;
        console.log(`[getRealtime] Trigger: requestSerial=${requestSerial}, onlineState=${triggerData.onlineState}`);
        console.log(`[getRealtime] Trigger response keys: ${Object.keys(triggerResponse).join(',')}`);
        console.log(`[getRealtime] Trigger data keys: ${Object.keys(triggerData).join(',').substring(0, 300)}`);
        console.log(`[getRealtime] Has vehicleInfo: ${!!vehicleInfo}, Has vehicleStatus: ${!!triggerData.vehicleStatus}`);
        // Log key fields for debugging
        const debugInfo = vehicleInfo || triggerData;
        console.log(`[getRealtime] Key fields: elecPercent=${debugInfo.elecPercent}, enduranceMileage=${debugInfo.enduranceMileage}, totalMileageV2=${debugInfo.totalMileageV2}, onlineState=${debugInfo.onlineState}`);

        // Check if trigger already has valid data (sometimes it comes back immediately)
        if (this.isRealtimeDataReady(triggerData)) {
            console.log('[getRealtime] Trigger returned ready data, using immediately');
            return this.parseRealtimeData(triggerData);
        }

        // If no serial, can't poll - return trigger data as-is
        if (!requestSerial) {
            console.log('[getRealtime] No requestSerial, returning trigger data');
            return this.parseRealtimeData(triggerData);
        }

        // Stage 2: Poll for fresh result using requestSerial
        // BYD-re/pyBYD send the FULL inner payload for poll too (same as trigger + requestSerial)
        // 10 attempts x 2s = ~20s (matching pyBYD/BYD-re approach)
        const pollInner = {
            deviceType: this.device.deviceType,
            energyType: '0',
            imeiMD5: this.device.imeiMD5,
            networkType: this.device.networkType,
            random: node_crypto.randomBytes(16).toString('hex').toUpperCase(),
            requestSerial,
            tboxVersion: this.device.tboxVersion,
            timeStamp: String(Date.now()),
            version: this.device.appInnerVersion,
            vin,
        };
        const result = await this.pollForResult(
            '/vehicleInfo/vehicle/vehicleRealTimeResult',
            pollInner,
            10,
            2000,
            (data: any) => this.isRealtimeDataReady(data),
            true  // rawInner
        );

        return this.parseRealtimeData(result);
    }

    /**
     * Check if realtime data has actual values (not stale/cached zeros)
     * Based on BYD-re's isRealtimeDataReady check
     */
    private isRealtimeDataReady(data: any): boolean {
        const info = data?.vehicleInfo || data?.vehicleStatus || data || {};

        // If onlineState is 2, car is offline
        if (Number(info.onlineState) === 2) return false;

        // Check for any non-zero tire pressure (indicates real data)
        const tireFields = ['leftFrontTirepressure', 'rightFrontTirepressure', 'leftRearTirepressure', 'rightRearTirepressure'];
        if (tireFields.some(f => Number(info[f]) > 0)) return true;

        // Check for timestamp
        if (Number(info.time) > 0) return true;

        // Check for endurance/range data
        if (Number(info.enduranceMileage || info.evEndurance) > 0) return true;

        // Check for SOC or odometer
        if (Number(info.elecPercent) > 0) return true;
        if (Number(info.totalMileageV2 || info.totalMileage || info.odo) > 0) return true;

        return false;
    }

    private parseRealtimeData(data: any): BydRealtime {
        const info = data.vehicleInfo || data.vehicleStatus || data;

        // Field names based on BYD-re reverse engineering
        const soc = this.parseNumber(info.elecPercent || info.powerBattery || info.soc, 0)!;
        const range = this.parseNumber(info.enduranceMileage || info.evEndurance || info.range, 0)!;
        const odometer = this.parseNumber(info.totalMileageV2 || info.totalMileage || info.odo || info.mileage, 0)!;

        // Detect offline state: if all key values are 0, car is likely asleep
        const isOffline = soc === 0 && range === 0 && odometer === 0;

        // Gear (1=Park, 3=Drive) and EPB
        const gear = this.parseNumber(info.powerGear);
        const parkingBrake = this.parseNumber(info.epb);

        // Lock state: check individual door locks (2 = locked) or global lockState
        // IMPORTANT: Default to TRUE (locked) when data is missing/zero.
        // When the car is in light sleep it may return partial data where lock fields
        // are absent or zero — treating that as "unlocked" caused false polling activation
        // (bydWakeVehicle would see isLocked=false and start polling, draining 12V battery).
        const hasLockData = info.leftFrontDoorLock !== undefined ||
            info.lockState !== undefined || info.doorLockState !== undefined;
        const isLocked = !hasLockData ? true :
            (Number(info.leftFrontDoorLock) === 2 ||
                info.lockState === '2' || info.doorLockState === '2');

        return {
            soc,
            range,
            odometer,
            speed: this.parseNumber(info.speed),
            isCharging: info.chargingState === 1 || info.chargeState === 1 || info.chargeStatus === '1',
            isLocked,
            isOnline: !isOffline && (Number(info.onlineState) !== 2),
            gear,
            parkingBrake,
            interiorTemp: this.parseNumber(info.tempInCar || info.interiorTemperature),
            doors: {
                frontLeft: Number(info.leftFrontDoor) === 2,
                frontRight: Number(info.rightFrontDoor) === 2,
                rearLeft: Number(info.leftRearDoor) === 2,
                rearRight: Number(info.rightRearDoor) === 2,
                trunk: Number(info.trunkLid) === 2,
                hood: Number(info.forehold) === 2,
            },
            windows: {
                frontLeft: Number(info.leftFrontWindow) === 2,
                frontRight: Number(info.rightFrontWindow) === 2,
                rearLeft: Number(info.leftRearWindow) === 2,
                rearRight: Number(info.rightRearWindow) === 2,
            },
            tirePressure: {
                frontLeft: this.parseNumber(info.leftFrontTirepressure, 0)!,
                frontRight: this.parseNumber(info.rightFrontTirepressure, 0)!,
                rearLeft: this.parseNumber(info.leftRearTirepressure, 0)!,
                rearRight: this.parseNumber(info.rightRearTirepressure, 0)!,
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
    async getGps(vin: string): Promise<BydGps> {
        // Stage 1: Trigger GPS request
        const triggerResponse = await this.postAuthenticatedJson(
            '/control/getGpsInfo',
            { vin }
        );

        if (String(triggerResponse.code) !== '0') {
            throw new Error(`Failed to trigger GPS: code=${triggerResponse.code} msg=${triggerResponse.msg}`);
        }

        // Extract requestSerial from trigger
        const triggerData = triggerResponse.data || {};
        const requestSerial = triggerData.requestSerial || null;
        console.log(`[getGps] Trigger returned requestSerial: ${requestSerial}`);

        // Stage 2: Poll for result with requestSerial - 8 attempts x 2s = ~16s
        const result = await this.pollForResult(
            '/control/getGpsInfoResult',
            { vin, ...(requestSerial ? { requestSerial } : {}) },
            8,
            2000
        );

        return this.parseGpsData(result);
    }

    private parseGpsData(data: any): BydGps {
        // GPS data can be nested: { res: 2, data: { latitude, longitude, ... } }
        // or flat: { latitude, longitude, ... }
        const gpsInfo = data.data || data;
        return {
            latitude: this.parseNumber(gpsInfo.latitude, 0)!,
            longitude: this.parseNumber(gpsInfo.longitude, 0)!,
            heading: this.parseNumber(gpsInfo.direction ?? gpsInfo.heading),
            speed: this.parseNumber(gpsInfo.speed),
            timestamp: gpsInfo.gpsTimeStamp ? Number(gpsInfo.gpsTimeStamp) : (gpsInfo.timestamp ? parseInt(gpsInfo.timestamp, 10) : undefined),
            raw: data,
        };
    }

    // =========================================================================
    // CHARGING STATUS
    // =========================================================================

    /**
     * Get charging status
     */
    async getChargingStatus(vin: string): Promise<BydCharging> {
        const response = await this.postAuthenticatedJson(
            '/control/smartCharge/homePage',
            { vin }
        );

        if (response.code !== '0') {
            throw new Error(`Failed to get charging: ${response.msg}`);
        }

        const data = response.data || {};
        return {
            soc: this.parseNumber(data.soc || data.currentSoc, 0)!,
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
    async getEmqBrokerInfo(): Promise<{ host: string; port: number } | null> {
        await this.ensureSession();
        const nowMs = Date.now();
        const randomHex = node_crypto.randomBytes(16).toString('hex').toUpperCase();

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
            const response = await this.postAuthenticatedJson(
                '/app/emqAuth/getEmqBrokerIp',
                inner,
                true  // rawInner = true, don't add reqTimestamp
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
        } catch (error) {
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
    async lock(vin: string, pin?: string): Promise<boolean> {
        return this.remoteControl(vin, 'LOCK', pin);
    }

    /**
     * Unlock vehicle
     */
    async unlock(vin: string, pin?: string): Promise<boolean> {
        return this.remoteControl(vin, 'UNLOCK', pin);
    }

    /**
     * Flash lights
     */
    async flashLights(vin: string, pin?: string): Promise<boolean> {
        return this.remoteControl(vin, 'FLASH_LIGHTS', pin);
    }

    /**
     * Honk horn
     */
    async honkHorn(vin: string, pin?: string): Promise<boolean> {
        return this.remoteControl(vin, 'FIND_CAR', pin);
    }

    /**
     * Start climate
     */
    async startClimate(vin: string, tempCelsius: number = 22, pin?: string): Promise<boolean> {
        // BYD uses scale 1-17 where 1=18°C, 17=32°C
        const bydTemp = Math.max(1, Math.min(17, tempCelsius - 17));
        const params = {
            mainSettingTemp: String(bydTemp),
            copilotSettingTemp: String(bydTemp),
            cycleMode: '2',  // Fresh air
            timeSpan: '15',  // 15 minutes
        };
        return this.remoteControl(vin, 'START_CLIMATE', pin, params);
    }

    /**
     * Stop climate
     */
    async stopClimate(vin: string, pin?: string): Promise<boolean> {
        return this.remoteControl(vin, 'STOP_CLIMATE', pin);
    }

    /**
     * Close windows
     */
    async closeWindows(vin: string, pin?: string): Promise<boolean> {
        return this.remoteControl(vin, 'CLOSE_WINDOWS', pin);
    }

    /**
     * Control seat climate/heating
     * @param vin Vehicle VIN
     * @param seat Seat position (0=driver, 1=passenger)
     * @param mode Heat level (0=off, 1=low, 2=medium, 3=high)
     * @param pin Control PIN
     */
    async seatClimate(vin: string, seat: number, mode: number, pin?: string): Promise<boolean> {
        const params = {
            seatNum: String(seat),  // 0=driver, 1=passenger
            level: String(mode),    // 0=off, 1=low, 2=medium, 3=high
        };
        return this.remoteControl(vin, 'SEAT_CLIMATE', pin, params);
    }

    /**
     * Control battery heating
     */
    async batteryHeat(vin: string, pin?: string): Promise<boolean> {
        return this.remoteControl(vin, 'BATTERY_HEAT', pin);
    }

    private async remoteControl(
        vin: string,
        command: string,
        pin?: string,
        params?: Record<string, string>
    ): Promise<boolean> {
        const controlPin = pin || this.config.controlPin;
        if (!controlPin) {
            throw new Error('Control PIN required for remote commands');
        }

        // Hash PIN if not already hashed
        // BYD API expects UPPERCASE MD5 hash for commandPwd
        const commandPwd = controlPin.length === 32 ? controlPin.toUpperCase() : md5Hex(controlPin);

        // Skip verifyControlPassword - it returns 1007 regardless of device profile.
        // pyBYD also does not require it before commands; commandPwd is sent inline.

        // Command codes - pyBYD uses string enum values, NOT numeric codes
        const commandCodes: Record<string, string> = {
            'LOCK': 'LOCKDOOR',
            'UNLOCK': 'OPENDOOR',
            'FLASH_LIGHTS': 'FLASHLIGHTNOWHISTLE',
            'FIND_CAR': 'FINDCAR',
            'START_CLIMATE': 'OPENAIR',
            'STOP_CLIMATE': 'CLOSEAIR',
            'CLOSE_WINDOWS': 'CLOSEWINDOW',
            'SEAT_CLIMATE': 'VENTILATIONHEATING',
            'BATTERY_HEAT': 'BATTERYHEAT',
        };

        const commandType = commandCodes[command];
        if (!commandType) {
            throw new Error(`Unknown command: ${command}`);
        }

        // Trigger command - field names must match pyBYD/BYD-re exactly
        // pyBYD uses 8 bytes (16 chars) for random in remote_control (vs 16 bytes/32 chars in login)
        // pyBYD: secrets.token_hex(16).upper() -> 32 characters
        const randomHex = node_crypto.randomBytes(16).toString('hex').toUpperCase();
        const nowMsStr = String(Date.now());

        const payload: any = {
            commandPwd,
            commandType,
            deviceType: this.device.deviceType,
            imeiMD5: this.device.imeiMD5,
            networkType: this.device.networkType,
            random: randomHex,
            timeStamp: nowMsStr,
            version: this.device.appInnerVersion,
            vin,
        };
        if (params) {
            // pyBYD: json.dumps(control_params, separators=(",", ":"), sort_keys=True)
            payload.controlParamsMap = compactJson(params);
        }

        console.log(`[remoteControl] Sending ${command} (type=${commandType}) for ${vin}`);
        const triggerResponse = await this.postAuthenticatedJson('/control/remoteControl', payload, true);

        if (String(triggerResponse.code) !== '0') {
            const payloadStr = JSON.stringify(payload);
            const errorMsg = triggerResponse.msg || triggerResponse.message || 'No error message';
            console.error(`[remoteControl] FAILED code=${triggerResponse.code} msg=${errorMsg}. Payload: ${payloadStr}`);
            // Include payload and detailed msg in error for frontend debugging
            throw new Error(`Remote control failed: code=${triggerResponse.code} msg=${errorMsg} payload=${payloadStr.substring(0, 100)}...`);
        }

        // Poll for result
        const result = await this.pollForResult(
            '/control/remoteControlResult',
            { vin, commandType },
            10,
            3000
        );

        return result.controlState === '1';
    }

    /*
    private async verifyControlPin(vin: string, commandPwd: string): Promise<void> {
        const randomHex = node_crypto.randomBytes(16).toString('hex').toUpperCase();
        const inner = {
            commandPwd,
            deviceType: this.device.deviceType,
            functionType: 'remoteControl',
            imeiMD5: this.device.imeiMD5,
            networkType: this.device.networkType,
            random: randomHex,
            timeStamp: String(Date.now()),
            version: this.device.appInnerVersion,
            vin,
        };

        const response = await this.postAuthenticatedJson(
            '/vehicle/vehicleswitch/verifyControlPassword',
            inner,
            true,  // rawInner
            false, // _isRetry
            false, // skipAutoRelogin
            '1'    // userType
        );

        if (response.code === '0') {
            console.log(`[verifyControlPin] PIN verified for ${vin}`);
            return;
        }

        if (response.code === '5005') {
            throw new Error('Wrong PIN - please check your control password');
        }
        if (response.code === '5006') {
            throw new Error('Cloud control locked for the day - too many wrong PIN attempts');
        }

        throw new Error(`PIN verification failed: code=${response.code} msg=${response.msg}`);
    }
    */

    // =========================================================================
    // HTTP TRANSPORT
    // =========================================================================

    /**
     * Make authenticated request with encrypted envelope
     * @param endpoint API endpoint
     * @param payload Inner payload data
     * @param rawInner If true, use payload as-is without adding reqTimestamp
     * @param skipAutoRelogin If true, don't intercept session-expired codes (used by pollForResult where 1002 means "still processing")
     */
    private async postAuthenticatedJson(
        endpoint: string,
        payload: any,
        rawInner: boolean = false,
        _isRetry: boolean = false,
        skipAutoRelogin: boolean = false,
        userType: string | null = null
    ): Promise<any> {
        const session = await this.ensureSession();
        const nowMs = Date.now();

        // Build inner payload
        const inner = rawInner ? payload : {
            ...payload,
            reqTimestamp: String(nowMs),
        };

        const reqTimestamp = rawInner && payload.timeStamp ? payload.timeStamp : String(nowMs);
        const contentKey = md5Hex(session.token.encryToken);
        const signKey = md5Hex(session.token.signToken);

        // Encrypt inner data with COMPACT JSON (no spaces)
        // Equivalent to Python's json.dumps(inner, separators=(',', ':'))
        const innerJson = compactJson(inner);
        const encryData = aesEncryptHex(innerJson, contentKey);

        // Build sign string
        const signFields = {
            ...inner,
            countryCode: this.config.countryCode,
            identifier: session.token.userId,
            imeiMD5: this.device.imeiMD5,
            language: this.device.language,
            reqTimestamp,
        };
        const signString = buildSignString(signFields, signKey);
        const sign = sha1Mixed(signString);

        // Build outer payload - ORDER MATTERS for checkcode in BYD's server
        // We construct it manually to ensure the object keys are in the correct order
        const outer: any = {
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
            serviceTime: String(Date.now()), // Fresh timestamp for outer
        };

        if (userType !== null) {
            outer.userType = userType;
        }

        outer.checkcode = computeCheckcode(outer);

        console.log(`[postAuthenticatedJson] endpoint: ${endpoint}`);
        console.log(`[postAuthenticatedJson] innerJson (compact): ${innerJson}`);
        console.log(`[postAuthenticatedJson] signString: ${signString}`);
        console.log(`[postAuthenticatedJson] outer.checkcode: ${outer.checkcode}`);
        console.log(`[postAuthenticatedJson] session: ${session.token.signToken.substring(0, 8)}...`);

        // Make request
        const response = await this.postSecure(endpoint, outer);
        const responseCode = String(response.code || '');
        console.log(`[postAuthenticatedJson] response code: ${responseCode}, msg: ${response.msg || response.message || ''}`);

        // Check for session expiration (1002=another device login, 1005/1010=expired)
        // IMPORTANT: Skip this for poll endpoints where 1002 means "still processing", not session expired
        if (!skipAutoRelogin && SESSION_EXPIRED_CODES.includes(responseCode)) {
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
            const decrypted = aesDecryptUtf8(response.respondData, contentKey);
            console.log(`[postAuthenticatedJson] Decrypted respondData: ${decrypted.substring(0, 200)}...`);
            // Handle empty or whitespace-only responses
            if (decrypted && decrypted.trim()) {
                response.data = JSON.parse(decrypted);
            } else {
                console.log(`[postAuthenticatedJson] Warning: empty decrypted response`);
                response.data = null;
            }
        }

        return response;
    }

    /**
     * Make request through Bangcle secure transport
     */
    private async postSecure(endpoint: string, payload: any): Promise<any> {
        if (!areBangcleTablesLoaded()) {
            throw new Error('Bangcle tables not loaded. Call loadBangcleTables() first.');
        }

        const url = BASE_URL + endpoint;
        const encoded = encodeEnvelope(JSON.stringify(payload));

        const headers: Record<string, string> = {
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'content-type': 'application/json; charset=UTF-8',
            'user-agent': 'okhttp/3.12.0',
        };

        if (Object.keys(this.cookies).length > 0) {
            const cookieStr = Object.entries(this.cookies)
                .map(([k, v]) => `${k}=${v}`)
                .join('; ');
            headers['Cookie'] = cookieStr;
            console.log(`[postSecure] Sending cookies: ${cookieStr}`);
        } else {
            console.log('[postSecure] No cookies to send.');
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ request: encoded }),
        });

        // Update cookies
        // node-fetch v2: response.headers.raw()['set-cookie'] returns array
        let setCookie: string | string[] | undefined;
        if (typeof (response.headers as any).raw === 'function') {
            const raw = (response.headers as any).raw();
            setCookie = raw['set-cookie'];
        } else if (typeof (response.headers as any).getSetCookie === 'function') {
            setCookie = (response.headers as any).getSetCookie();
        } else {
            setCookie = response.headers.get('set-cookie') || undefined;
        }

        if (setCookie) {
            console.log(`[postSecure] Received cookies: ${Array.isArray(setCookie) ? setCookie.join('; ') : setCookie}`);
            this.parseCookies(setCookie);
        }

        const bodyText = await response.text();
        let body: any;

        try {
            body = JSON.parse(bodyText);
        } catch (e) {
            throw new Error(`Server returned non-JSON response: ${bodyText.substring(0, 500)}`);
        }

        if (!body.response) {
            // Check if this is an error response
            if (body.code || body.msg || body.message) {
                throw new Error(`Server error: code=${body.code}, msg=${body.msg || body.message}`);
            }
            throw new Error(`Invalid response: missing response field. Body: ${bodyText.substring(0, 500)}`);
        }

        const decoded = decodeEnvelope(body.response);

        try {
            const parsed = JSON.parse(decoded);
            // Normalize code to string for consistent comparisons across the codebase
            if (parsed.code !== undefined) {
                parsed.code = String(parsed.code);
            }
            return parsed;
        } catch (e) {
            throw new Error(`Failed to parse decoded response as JSON. Decoded: ${decoded.substring(0, 500)}`);
        }
    }

    /**
     * Poll for async result
     * @param validator Optional function to validate the data - return false to keep polling
     */
    private async pollForResult(
        endpoint: string,
        payload: any,
        maxAttempts: number,
        delayMs: number,
        validator?: (data: any) => boolean,
        rawInner: boolean = false
    ): Promise<any> {
        let lastData: any = null;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            // Always wait before polling (give the car time to respond to trigger)
            console.log(`[pollForResult] ${endpoint} attempt ${attempt + 1}/${maxAttempts}, waiting ${delayMs}ms...`);
            await this.sleep(delayMs);

            // Refresh random and timeStamp on each poll attempt (as BYD-re does)
            if (rawInner && payload.timeStamp) {
                payload.timeStamp = String(Date.now());
                payload.random = node_crypto.randomBytes(16).toString('hex').toUpperCase();
            }

            // skipAutoRelogin=true: in poll contexts, 1002 means "still processing", not session expired
            const response = await this.postAuthenticatedJson(endpoint, payload, rawInner, false, true);
            const code = String(response.code || '');
            console.log(`[pollForResult] ${endpoint} attempt ${attempt + 1}: code=${code}`);

            if (code === '0' && response.data) {
                // Log key fields for debugging
                const d = response.data.vehicleInfo || response.data.vehicleStatus || response.data;
                console.log(`[pollForResult] ${endpoint} data: elecPercent=${d.elecPercent}, enduranceMileage=${d.enduranceMileage}, onlineState=${d.onlineState}, time=${d.time}`);
                // If validator provided, check if data is actually valid
                if (validator && !validator(response.data)) {
                    lastData = response.data; // Keep as fallback
                    continue; // Keep polling for valid data
                }
                return response.data;
            }

            // Still processing (note: 1002 in pollForResult means "still processing", NOT session expired)
            if (code === '1002' || code === '1003') {
                continue;
            }

            // Vehicle offline/not responding
            if (code === '1009') {
                // If we had some data (even zeros), return it rather than throwing
                if (lastData) {
                    console.log('[pollForResult] Vehicle went offline, returning last data');
                    return lastData;
                }
                throw new Error('Vehicle offline - car may be asleep. Try again when the car is awake (driving, charging, or recently used).');
            }

            // Error
            if (code !== '0') {
                throw new Error(`Poll failed: ${response.msg || code}`);
            }
        }

        // If we got data but it never passed validation, return it anyway (best effort)
        if (lastData) {
            console.log('[pollForResult] Polling timeout, returning best available data');
            return lastData;
        }

        throw new Error('Polling timeout');
    }

    // =========================================================================
    // UTILITIES
    // =========================================================================

    private parseCookies(setCookie: string | string[]): void {
        const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];

        for (const cookieStr of cookies) {
            // Some servers send multiple cookies in one header separated by comma (bad practice but happens)
            // But raw() splits them into array. If we get a string, it might still have commas?
            // node-fetch v2 might give comma-separated if we use get().
            // Safest: split by comma ONLY if it's a string and looks like multiple cookies?
            // Actually, split(',') is dangerous because Expires=... has commas.
            // Better to rely on array from raw(). If string, assume one cookie or use a smart splitter.
            // For now, let's assume raw() gave us individual cookies.

            const parts = cookieStr.split(';');
            const [nameValue] = parts;
            if (!nameValue) continue;

            const [name, ...valueParts] = nameValue.trim().split('=');
            if (name && valueParts.length > 0) {
                this.cookies[name.trim()] = valueParts.join('=').trim();
            }
        }
    }

    private parseNumber(value: any, defaultValue?: number): number | undefined {
        if (value === null || value === undefined || value === '') {
            return defaultValue;
        }
        const num = typeof value === 'string' ? parseFloat(value) : value;
        return isNaN(num) ? defaultValue : num;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
