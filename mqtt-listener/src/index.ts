/**
 * BYD MQTT Listener - Multi-User Version
 *
 * Connects to BYD's MQTT broker for all premium users and forwards
 * vehicle events to Firebase. Uses Firebase Functions for authentication.
 *
 * Run with: npm start
 */

import * as mqtt from 'mqtt';
import * as admin from 'firebase-admin';
import { md5Hex, aesDecryptUtf8, aesDecryptWithIv } from './crypto';

// Load environment variables
require('dotenv').config();

// Initialize Firebase Admin
const serviceAccount = require('../firebase-service-account.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// Configuration
const config = {
    encryptionKey: process.env.TOKEN_ENCRYPTION_KEY!,
    mqttKeepalive: 120,
    reconnectDelay: 10000,
    tokenRefreshInterval: 4 * 60 * 60 * 1000, // 4 hours
    healthCheckInterval: 60 * 1000, // 1 minute
    firebaseRegion: 'europe-west1',
    firebaseProject: 'REDACTED_FIREBASE_PROJECT_ID',
};

// Validate config
function validateConfig() {
    if (!config.encryptionKey) {
        console.error('Missing TOKEN_ENCRYPTION_KEY in .env');
        process.exit(1);
    }
}

// =============================================================================
// FIREBASE FUNCTION CALLS
// =============================================================================

interface BydSession {
    userId: string;
    signToken: string;
    encryToken: string;
    brokerHost: string;
    brokerPort: number;
}

/**
 * Call Firebase function to get MQTT credentials
 * This uses the working BYD login code in Firebase
 */
async function getMqttCredentials(vin: string): Promise<BydSession> {
    const https = require('https');

    // Get ID token for authentication
    const idToken = await admin.auth().createCustomToken('mqtt-listener');

    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({ data: { vin } });

        const options = {
            hostname: `${config.firebaseRegion}-${config.firebaseProject}.cloudfunctions.net`,
            port: 443,
            path: '/bydGetMqttCredentials',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
            },
        };

        const req = https.request(options, (res: any) => {
            let data = '';
            res.on('data', (chunk: string) => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    console.log('[getMqttCredentials] Raw response:', JSON.stringify(response).substring(0, 500));

                    // Firebase callable functions wrap the response in "result"
                    const result = response.result || response;

                    if (result?.success && result?.credentials) {
                        const creds = result.credentials;
                        console.log('[getMqttCredentials] Credentials received - brokerHost:', creds.brokerHost, 'brokerPort:', creds.brokerPort);
                        resolve({
                            userId: creds.userId,
                            signToken: creds.signToken,
                            encryToken: creds.encryToken,
                            brokerHost: creds.brokerHost || 'emqoversea-eu.byd.auto',
                            brokerPort: creds.brokerPort || 8883,
                        });
                    } else {
                        reject(new Error(response.error?.message || 'Failed to get credentials'));
                    }
                } catch (e) {
                    reject(new Error(`Parse error: ${data.substring(0, 200)}`));
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// =============================================================================
// ENCRYPTION HELPERS
// =============================================================================

function decryptCredential(encrypted: string): string {
    const crypto = require('crypto');
    const [ivHex, authTagHex, dataHex] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');
    const key = Buffer.from(config.encryptionKey, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(data, undefined, 'utf8') + decipher.final('utf8');
}

// =============================================================================
// MQTT CONNECTION MANAGER
// =============================================================================

interface VehicleConnection {
    vin: string;
    userId: string;
    client: mqtt.MqttClient | null;
    pushClient: mqtt.MqttClient | null;  // Second connection for push broker
    session: BydSession | null;
    lastEvent: number;
    reconnectTimer: NodeJS.Timeout | null;
}

// Alternative MQTT brokers to try
const MQTT_BROKERS = [
    { host: 'emqoversea-eu.byd.auto', port: 8883, name: 'emq-response' },
    { host: 'dilinkpush-eu.byd.auto', port: 8443, name: 'push' },
    { host: 'agoversea-eu-gcp.byd.auto', port: 8883, name: 'gcp' },
];

class BydMqttManager {
    private connections: Map<string, VehicleConnection> = new Map();
    private unsubscribe: (() => void) | null = null;

    async start(): Promise<void> {
        console.log('='.repeat(60));
        console.log('BYD MQTT Listener - Multi-User v2.0');
        console.log('='.repeat(60));

        validateConfig();

        // Listen to Firestore for active BYD vehicles
        this.unsubscribe = db.collection('bydVehicles')
            .onSnapshot(
                (snapshot: admin.firestore.QuerySnapshot) => this.handleVehiclesSnapshot(snapshot),
                (error: Error) => console.error('Firestore listener error:', error)
            );

        // Health check interval
        setInterval(() => this.healthCheck(), config.healthCheckInterval);

        console.log('Listening for BYD vehicles in Firestore...');
    }

    private async handleVehiclesSnapshot(snapshot: admin.firestore.QuerySnapshot): Promise<void> {
        const activeVins = new Set<string>();

        for (const doc of snapshot.docs) {
            const vin = doc.id;
            const data = doc.data();

            // Skip if no userId (not connected)
            if (!data.userId) continue;

            activeVins.add(vin);

            // Connect if not already connected
            if (!this.connections.has(vin)) {
                console.log(`[${vin}] New vehicle detected, connecting...`);
                this.connectVehicle(vin);
            }
        }

        // Disconnect removed vehicles
        for (const [vin] of this.connections) {
            if (!activeVins.has(vin)) {
                console.log(`[${vin}] Vehicle removed, disconnecting...`);
                this.disconnectVehicle(vin);
            }
        }

        console.log(`Active connections: ${this.connections.size}`);
    }

    private async connectVehicle(vin: string): Promise<void> {
        try {
            // Get MQTT credentials via Firebase function
            console.log(`[${vin}] Getting MQTT credentials from Firebase...`);
            const session = await getMqttCredentials(vin);

            console.log(`[${vin}] Got credentials, userId: ${session.userId}, broker: ${session.brokerHost}:${session.brokerPort}`);

            // Create connection record
            const conn: VehicleConnection = {
                vin,
                userId: session.userId,
                client: null,
                pushClient: null,
                session,
                lastEvent: Date.now(),
                reconnectTimer: null,
            };

            this.connections.set(vin, conn);

            // Connect to BOTH MQTT brokers (response + push)
            this.connectMqtt(conn);
            this.connectPushBroker(conn);

            // Schedule token refresh
            this.scheduleTokenRefresh(vin);

        } catch (error: any) {
            console.error(`[${vin}] Connection failed:`, error.message);
            // Retry after delay
            setTimeout(() => {
                if (!this.connections.has(vin)) {
                    this.connectVehicle(vin);
                }
            }, config.reconnectDelay);
        }
    }

    private connectMqtt(conn: VehicleConnection): void {
        if (!conn.session) return;

        const { userId, signToken, brokerHost, brokerPort } = conn.session;
        const clientId = `oversea_00000000000000000000000000000000`;
        const timestamp = String(Math.floor(Date.now() / 1000)); // pyBYD uses seconds, not milliseconds

        // pyBYD password format (from BYD-re reverse engineering):
        // base = signToken + clientId + userId + timestamp
        // password = timestamp + UPPERCASE(md5(base))
        const base = signToken + clientId + userId + timestamp;
        const password = timestamp + md5Hex(base).toUpperCase();

        // pyBYD username is just userId
        const username = userId;

        const brokerUrl = `mqtts://${brokerHost}:${brokerPort}`;
        console.log(`[${conn.vin}] Connecting to MQTT broker: ${brokerUrl}`);
        console.log(`[${conn.vin}] MQTT auth - username: ${username}, timestamp: ${timestamp}`);
        console.log(`[${conn.vin}] MQTT auth - password: ${password.substring(0, 20)}...`);

        const client = mqtt.connect(brokerUrl, {
            clientId,
            username,
            password,
            keepalive: config.mqttKeepalive,
            reconnectPeriod: 0, // Manual reconnect
            rejectUnauthorized: true,
            protocolVersion: 5, // pyBYD uses MQTTv5
        });

        conn.client = client;

        client.on('connect', () => {
            console.log(`[${conn.vin}] MQTT connected! Listening for events...`);

            // Mark MQTT as connected but DON'T activate polling yet
            // Polling will be activated when we receive an actual event from the car
            this.markMqttConnected(conn.vin);

            // Subscribe to multiple topics to catch all messages
            const topics = [
                `oversea/res/${userId}`,           // Main response topic
                `oversea/res/${userId}/#`,         // All subtopics
                `oversea/push/${userId}`,          // Push notifications
                `oversea/push/${userId}/#`,        // Push subtopics
                `oversea/${userId}/#`,             // All user topics
            ];

            for (const topic of topics) {
                client.subscribe(topic, { qos: 1 }, (err) => {  // QoS 1 like ioBroker.byd
                    if (err) {
                        console.error(`[${conn.vin}] Subscribe failed for ${topic}:`, err);
                    } else {
                        console.log(`[${conn.vin}] Subscribed to ${topic}`);
                    }
                });
            }

            // After connecting and subscribing, trigger a refresh to test MQTT push
            // This should generate a response that arrives via MQTT
            setTimeout(() => {
                this.triggerMqttRefresh(conn.vin);
            }, 2000);  // Wait 2 seconds for subscriptions to complete
        });

        client.on('message', (topic, message) => {
            this.handleMessage(conn, topic, message);
        });

        client.on('error', (error) => {
            console.error(`[${conn.vin}] MQTT error:`, error.message);
        });

        client.on('close', () => {
            console.log(`[${conn.vin}] MQTT connection closed`);
            this.deactivatePolling(conn.vin);
            this.scheduleReconnect(conn);
        });
    }

    /**
     * Connect to the PUSH broker (dilinkpush-eu.byd.auto:8443)
     * This might be the broker that sends real-time push notifications
     */
    private connectPushBroker(conn: VehicleConnection): void {
        if (!conn.session) return;

        const { userId, signToken } = conn.session;
        const pushHost = 'dilinkpush-eu.byd.auto';
        const pushPort = 8443;
        const clientId = `oversea_00000000000000000000000000000000`;
        const timestamp = String(Math.floor(Date.now() / 1000));

        // Same auth format as main broker
        const base = signToken + clientId + userId + timestamp;
        const password = timestamp + md5Hex(base).toUpperCase();
        const username = userId;

        // Try both protocols: WSS (WebSocket Secure) and MQTTS
        const wsUrl = `wss://${pushHost}:${pushPort}/mqtt`;
        const mqttsUrl = `mqtts://${pushHost}:${pushPort}`;

        console.log(`[${conn.vin}] Connecting to PUSH broker (WSS): ${wsUrl}`);

        // Try WebSocket first - many push brokers use WSS
        const client = mqtt.connect(wsUrl, {
            clientId: clientId + '_push',
            username,
            password,
            keepalive: config.mqttKeepalive,
            reconnectPeriod: 0,
            rejectUnauthorized: true,
            protocolVersion: 4,  // MQTT 3.1.1
        });

        conn.pushClient = client;

        client.on('connect', () => {
            console.log(`[${conn.vin}] PUSH broker connected!`);

            // Subscribe to all possible push topics
            const topics = [
                `oversea/res/${userId}`,
                `oversea/res/${userId}/#`,
                `oversea/push/${userId}`,
                `oversea/push/${userId}/#`,
                `push/${userId}`,
                `push/${userId}/#`,
                `dilink/push/${userId}`,
                `dilink/push/${userId}/#`,
                `#`,  // Subscribe to ALL topics to discover what's available
            ];

            for (const topic of topics) {
                client.subscribe(topic, { qos: 0 }, (err) => {
                    if (err) {
                        console.log(`[${conn.vin}] PUSH subscribe ${topic}: ${err.message}`);
                    } else {
                        console.log(`[${conn.vin}] PUSH subscribed to ${topic}`);
                    }
                });
            }
        });

        client.on('message', (topic, message) => {
            console.log(`[${conn.vin}] *** PUSH BROKER MESSAGE ***`);
            this.handleMessage(conn, topic, message);
        });

        client.on('error', (error) => {
            console.error(`[${conn.vin}] PUSH broker error:`, error.message);
        });

        client.on('close', () => {
            console.log(`[${conn.vin}] PUSH broker connection closed`);
        });
    }

    /**
     * Trigger a data refresh via Firebase to test MQTT push
     * This uses the stored session so responses should arrive via MQTT
     */
    private async triggerMqttRefresh(vin: string): Promise<void> {
        const https = require('https');

        console.log(`[${vin}] Triggering MQTT refresh via Firebase...`);

        const postData = JSON.stringify({ data: { vin } });

        const options = {
            hostname: `${config.firebaseRegion}-${config.firebaseProject}.cloudfunctions.net`,
            port: 443,
            path: '/bydTriggerMqttRefresh',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
            },
        };

        const req = https.request(options, (res: any) => {
            let data = '';
            res.on('data', (chunk: string) => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.result?.success) {
                        console.log(`[${vin}] MQTT refresh triggered successfully`);
                        console.log(`[${vin}] Response data: SOC=${response.result.realtime?.soc}%, Range=${response.result.realtime?.range}km`);
                    } else {
                        console.log(`[${vin}] MQTT refresh failed:`, response.error?.message || data.substring(0, 200));
                    }
                } catch (e) {
                    console.log(`[${vin}] MQTT refresh parse error:`, data.substring(0, 200));
                }
            });
        });

        req.on('error', (error: any) => {
            console.error(`[${vin}] MQTT refresh request error:`, error.message);
        });

        req.write(postData);
        req.end();
    }

    private handleMessage(conn: VehicleConnection, topic: string, message: Buffer): void {
        conn.lastEvent = Date.now();

        // Note: Polling activation is now event-specific
        // Only activate for trip-relevant events (UNLOCK, vehicleInfo with open doors)
        // This avoids polling for unrelated events (climate preconditioning, etc.)
        console.log(`[${conn.vin}] ===== MQTT MESSAGE RECEIVED =====`);

        try {
            let payload: any;

            // DIAGNOSTIC: Log raw buffer info
            console.log(`[${conn.vin}] Message received on topic: ${topic}`);
            console.log(`[${conn.vin}] Topic: ${topic}`);
            console.log(`[${conn.vin}] Buffer length: ${message.length}`);
            console.log(`[${conn.vin}] First 32 bytes (hex): ${message.subarray(0, 32).toString('hex')}`);
            console.log(`[${conn.vin}] First 32 bytes (utf8): ${message.subarray(0, 32).toString('utf8')}`);

            const messageStr = message.toString('utf8').trim();
            console.log(`[${conn.vin}] Message length: ${messageStr.length} bytes`);

            // Try JSON first (like ioBroker.byd does)
            try {
                payload = JSON.parse(messageStr);
                console.log(`[${conn.vin}] Plain JSON message - Event: ${payload.event || 'unknown'}`);
                console.log(`[${conn.vin}] JSON content: ${JSON.stringify(payload).substring(0, 200)}`);
            } catch (jsonError) {
                // Not JSON, continue with hex check
            }

            // If not JSON, check if it looks like hex-encoded encrypted data
            const isHexEncoded = !payload && /^[0-9A-Fa-f]+$/.test(messageStr) && messageStr.length > 100;

            if (isHexEncoded) {
                const encryToken = conn.session!.encryToken;
                const decryptKey = md5Hex(encryToken);
                const decryptKeyLower = decryptKey.toLowerCase();
                // Also try using encryToken directly (first 32 hex chars of UTF-8 bytes = 16 bytes for AES key)
                const encryTokenHex = Buffer.from(encryToken.substring(0, 16), 'utf8').toString('hex');

                console.log(`[${conn.vin}] Attempting decryption (encrypted message, ${messageStr.length} chars)`);

                // Static key found in BYD app reverse engineering (Base64: OlLzwi7W/N5b9pamwCyecw==)
                const staticKey = '3a52f3c22ed6fcde5bf696a6c02c9e73';

                // Helper to try base64 decode first then AES decrypt
                const tryBase64ThenDecrypt = (b64: string, key: string): string => {
                    const decoded = Buffer.from(b64, 'base64');
                    const hexStr = decoded.toString('hex');
                    return aesDecryptUtf8(hexStr, key);
                };

                // Try multiple decryption strategies
                const strategies = [
                    // Standard hex input
                    { name: 'md5-zero-iv-upper', fn: () => aesDecryptUtf8(messageStr, decryptKey) },
                    { name: 'md5-zero-iv-lower', fn: () => aesDecryptUtf8(messageStr, decryptKeyLower) },
                    { name: 'md5-first-block-iv-upper', fn: () => aesDecryptWithIv(messageStr, decryptKey) },
                    { name: 'md5-first-block-iv-lower', fn: () => aesDecryptWithIv(messageStr, decryptKeyLower) },
                    { name: 'raw-token-zero-iv', fn: () => aesDecryptUtf8(messageStr, encryTokenHex) },
                    { name: 'raw-token-first-block-iv', fn: () => aesDecryptWithIv(messageStr, encryTokenHex) },
                    { name: 'static-key-zero-iv', fn: () => aesDecryptUtf8(messageStr, staticKey) },
                    { name: 'static-key-first-block-iv', fn: () => aesDecryptWithIv(messageStr, staticKey) },
                    // Base64 input (decode first then decrypt)
                    { name: 'base64-md5-upper', fn: () => tryBase64ThenDecrypt(messageStr, decryptKey) },
                    { name: 'base64-md5-lower', fn: () => tryBase64ThenDecrypt(messageStr, decryptKeyLower) },
                ];

                let decrypted: string | null = null;
                const errors: string[] = [];
                for (const strategy of strategies) {
                    try {
                        decrypted = strategy.fn();
                        // Verify it's valid JSON
                        payload = JSON.parse(decrypted);
                        console.log(`[${conn.vin}] Decrypt SUCCESS (${strategy.name}) - Event: ${payload.event || 'unknown'}`);
                        break;
                    } catch (e: any) {
                        errors.push(`${strategy.name}: ${e.message}`);
                        // Try next strategy
                    }
                }

                if (!payload) {
                    // Decryption failed - this is expected because the BYD app uses a different session
                    // with different encryToken than ours. The important thing is we already triggered
                    // polling above, so HTTP responses will use OUR session and can be decrypted.
                    console.log(`[${conn.vin}] Decryption failed (expected - app uses different session). Polling already triggered.`);
                    return; // Can't forward undecrypted message, but polling is active
                }
            } else if (!payload) {
                // Not hex and not JSON - still fine, we triggered polling
                console.log(`[${conn.vin}] Message format unknown. Polling already triggered.`);
                return;
            }

            // Forward to Firestore
            this.forwardEvent(conn.vin, payload);

        } catch (error: any) {
            console.error(`[${conn.vin}] Message handling error:`, error.message);
        }
    }

    private async forwardEvent(vin: string, payload: any): Promise<void> {
        try {
            // Helper to clean undefined values for Firestore
            const cleanForFirestore = (obj: any): any => {
                if (!obj) return obj;
                return Object.entries(obj).reduce((acc, [key, value]) => {
                    if (value !== undefined) {
                        acc[key] = value;
                    }
                    return acc;
                }, {} as any);
            };

            // Write to Firestore events collection
            await db.collection('bydEvents').add({
                vin,
                event: payload.event,
                data: cleanForFirestore(payload.data || payload.respondData || payload),
                receivedAt: admin.firestore.Timestamp.now(),
                processed: false,
            });

            const vehicleRef = db.collection('bydVehicles').doc(vin);

            // Handle vehicleInfo event
            if (payload.event === 'vehicleInfo') {
                const data = payload.data?.respondData || payload.data || {};
                const currentSoC = (data.elecPercent || 0) / 100;
                const isCharging = data.chargeState === 1;
                const isUnlocked = data.lockState !== '2' && data.doorLockState !== '2';

                // Get previous state for comparison
                const vehicleDoc = await vehicleRef.get();
                const prevState = vehicleDoc.data() || {};
                const wasCharging = prevState.isCharging === true;

                // Extract static data from vehicleInfo
                const exteriorTemp = data.outsideTempValue ?? data.exteriorTemp ?? data.tempOutCar;
                const interiorTemp = data.tempInCar ?? data.interiorTemp;
                const tirePressure = (data.leftFrontTirepressure || data.tirePressure) ? {
                    frontLeft: data.leftFrontTirepressure || data.tirePressure?.frontLeft || 0,
                    frontRight: data.rightFrontTirepressure || data.tirePressure?.frontRight || 0,
                    rearLeft: data.leftRearTirepressure || data.tirePressure?.rearLeft || 0,
                    rearRight: data.rightRearTirepressure || data.tirePressure?.rearRight || 0,
                } : null;

                // Update vehicle state - capture ALL available data
                // Only include fields that have defined values (Firestore rejects undefined)
                const updateData: any = {
                    lastSoC: currentSoC,
                    lastRange: data.evEndurance || data.enduranceMileage || 0,
                    lastOdometer: data.odo || data.mileage || data.totalMileageV2 || data.totalMileage || 0,
                    lastSpeed: data.speed || 0,
                    isCharging,
                    isLocked: !isUnlocked,
                    isOnline: true,
                    lastMqttUpdate: admin.firestore.Timestamp.now(),
                };

                // Only add optional fields if they have actual values
                if (exteriorTemp !== undefined && exteriorTemp !== null) updateData.exteriorTemp = exteriorTemp;
                if (interiorTemp !== undefined && interiorTemp !== null) updateData.interiorTemp = interiorTemp;
                if (tirePressure) updateData.tirePressure = tirePressure;
                if (data.doors) updateData.doors = data.doors;
                if (data.windows) updateData.windows = data.windows;

                await vehicleRef.update(updateData);

                // CHARGING SESSION TRACKING
                if (isCharging && !wasCharging) {
                    // Started charging - create new session
                    await this.startChargingSession(vin, currentSoC);
                } else if (!isCharging && wasCharging) {
                    // Stopped charging - close session
                    await this.endChargingSession(vin, currentSoC);
                } else if (isCharging && wasCharging) {
                    // Still charging - update session
                    await this.updateChargingSession(vin, currentSoC);
                }

                // POLLING ACTIVATION
                // Only activate polling if car is actually unlocked (potential trip)
                // Don't activate for locked/parked status updates
                if (isUnlocked) {
                    console.log(`[${vin}] vehicleInfo: Car is OPEN - activating polling for trip detection`);
                    await this.activatePolling(vin);
                }
            }

            // Handle remoteControl event (unlock from app, etc.)
            if (payload.event === 'remoteControl') {
                const data = payload.data || {};
                const controlType = data.controlType || data.type || '';

                // Only activate polling for trip-relevant commands (UNLOCK)
                // Skip: climate control, other non-trip events
                if (controlType === 'UNLOCK' || controlType === '2' || controlType.toLowerCase().includes('unlock')) {
                    console.log(`[${vin}] remoteControl: UNLOCK detected - activating polling for trip detection`);
                    await this.activatePolling(vin);
                } else {
                    console.log(`[${vin}] remoteControl: ${controlType} - no polling needed`);
                }

                // Update vehicle state with only defined values
                const controlEvent: any = {
                    type: controlType,
                    timestamp: admin.firestore.Timestamp.now(),
                };
                const status = data.controlState || data.status;
                if (status !== undefined) {
                    controlEvent.status = status;
                }

                await vehicleRef.update({
                    lastControlEvent: controlEvent,
                });
            }

            console.log(`[${vin}] Event forwarded to Firestore`);

        } catch (error: any) {
            console.error(`[${vin}] Failed to forward event:`, error.message);
        }
    }

    // =========================================================================
    // CHARGING SESSION MANAGEMENT
    // =========================================================================

    private async startChargingSession(vin: string, startSoC: number): Promise<void> {
        try {
            const vehicleRef = db.collection('bydVehicles').doc(vin);
            const vehicleDoc = await vehicleRef.get();
            const vehicleData = vehicleDoc.data() || {};

            const sessionRef = db.collection('bydVehicles').doc(vin).collection('chargingSessions').doc();
            await sessionRef.set({
                vin,
                status: 'in_progress',
                startTime: admin.firestore.Timestamp.now(),
                startSoC,
                currentSoC: startSoC,
                startOdometer: vehicleData.lastOdometer || 0,
                batteryCapacity: vehicleData.batteryCapacity || 82.56, // BYD SEAL default
                source: 'mqtt',
                createdAt: admin.firestore.Timestamp.now(),
            });

            // Store active session ID in vehicle document
            await vehicleRef.update({
                activeChargingSessionId: sessionRef.id,
            });

            console.log(`[${vin}] CHARGING STARTED - Session ${sessionRef.id}, SoC: ${(startSoC * 100).toFixed(1)}%`);
        } catch (error: any) {
            console.error(`[${vin}] Failed to start charging session:`, error.message);
        }
    }

    private async updateChargingSession(vin: string, currentSoC: number): Promise<void> {
        try {
            const vehicleRef = db.collection('bydVehicles').doc(vin);
            const vehicleDoc = await vehicleRef.get();
            const vehicleData = vehicleDoc.data() || {};
            const sessionId = vehicleData.activeChargingSessionId;

            if (!sessionId) return;

            const sessionRef = db.collection('bydVehicles').doc(vin).collection('chargingSessions').doc(sessionId);
            await sessionRef.update({
                currentSoC,
                lastUpdate: admin.firestore.Timestamp.now(),
            });

            console.log(`[${vin}] Charging update - SoC: ${(currentSoC * 100).toFixed(1)}%`);
        } catch (error: any) {
            console.error(`[${vin}] Failed to update charging session:`, error.message);
        }
    }

    private async endChargingSession(vin: string, endSoC: number): Promise<void> {
        try {
            const vehicleRef = db.collection('bydVehicles').doc(vin);
            const vehicleDoc = await vehicleRef.get();
            const vehicleData = vehicleDoc.data() || {};
            const sessionId = vehicleData.activeChargingSessionId;

            if (!sessionId) {
                console.log(`[${vin}] No active charging session to close`);
                return;
            }

            const sessionRef = db.collection('bydVehicles').doc(vin).collection('chargingSessions').doc(sessionId);
            const sessionDoc = await sessionRef.get();
            const sessionData = sessionDoc.data();

            if (!sessionData) return;

            const startTime = sessionData.startTime?.toMillis() || Date.now();
            const endTime = Date.now();
            const durationMinutes = Math.round((endTime - startTime) / 60000);
            const durationHours = durationMinutes / 60;

            const startSoC = sessionData.startSoC || 0;
            const socDelta = endSoC - startSoC;
            const batteryCapacity = sessionData.batteryCapacity || 82.56;
            const energyAddedKwh = Math.round(Math.max(0, socDelta * batteryCapacity) * 100) / 100;

            await sessionRef.update({
                status: 'completed',
                endTime: admin.firestore.Timestamp.now(),
                endSoC,
                energyAddedKwh,
                durationMinutes,
                durationHours: Math.round(durationHours * 100) / 100,
                socGained: Math.round(socDelta * 10000) / 100, // Percentage points gained
            });

            // Clear active session
            await vehicleRef.update({
                activeChargingSessionId: admin.firestore.FieldValue.delete(),
            });

            console.log(`[${vin}] CHARGING ENDED - Session ${sessionId}`);
            console.log(`[${vin}]   Duration: ${durationMinutes} min (${durationHours.toFixed(2)} hours)`);
            console.log(`[${vin}]   SoC: ${(startSoC * 100).toFixed(1)}% → ${(endSoC * 100).toFixed(1)}% (+${(socDelta * 100).toFixed(1)}%)`);
            console.log(`[${vin}]   Energy added: ${energyAddedKwh} kWh`);
        } catch (error: any) {
            console.error(`[${vin}] Failed to end charging session:`, error.message);
        }
    }

    /**
     * Mark MQTT as connected (but don't activate polling yet)
     * Polling will be activated only when we receive actual vehicle events
     */
    private async markMqttConnected(vin: string): Promise<void> {
        try {
            await db.collection('bydVehicles').doc(vin).update({
                mqttConnected: true,
                lastMqttConnect: admin.firestore.Timestamp.now(),
            });
            console.log(`[${vin}] MQTT connection marked - waiting for vehicle events`);
        } catch (error: any) {
            console.error(`[${vin}] Failed to mark MQTT connected:`, error.message);
        }
    }

    /**
     * Activate polling when we receive actual vehicle activity (events)
     * This prevents unnecessary API calls when the car is dormant
     */
    private async activatePolling(vin: string): Promise<void> {
        try {
            await db.collection('bydVehicles').doc(vin).update({
                pollingActive: true,
                isOnline: true,
                stationaryPollCount: 0, // Reset counter
            });
            console.log(`[${vin}] Polling activated - car is active!`);
        } catch (error: any) {
            console.error(`[${vin}] Failed to activate polling:`, error.message);
        }
    }

    /**
     * Deactivate polling when MQTT disconnects for extended period
     */
    private async deactivatePolling(vin: string): Promise<void> {
        try {
            await db.collection('bydVehicles').doc(vin).update({
                mqttConnected: false,
                lastMqttDisconnect: admin.firestore.Timestamp.now(),
            });
            console.log(`[${vin}] MQTT disconnected - polling will be managed by Firebase`);
        } catch (error: any) {
            console.error(`[${vin}] Failed to update disconnect status:`, error.message);
        }
    }

    private scheduleReconnect(conn: VehicleConnection): void {
        if (conn.reconnectTimer) return;

        console.log(`[${conn.vin}] Reconnecting in ${config.reconnectDelay / 1000}s...`);

        conn.reconnectTimer = setTimeout(async () => {
            conn.reconnectTimer = null;

            // Get fresh tokens
            try {
                console.log(`[${conn.vin}] Refreshing tokens...`);
                conn.session = await getMqttCredentials(conn.vin);
                console.log(`[${conn.vin}] Token refresh successful`);
            } catch (error: any) {
                console.error(`[${conn.vin}] Token refresh failed:`, error.message);
            }

            if (conn.session) {
                this.connectMqtt(conn);
            }
        }, config.reconnectDelay);
    }

    private scheduleTokenRefresh(vin: string): void {
        setInterval(async () => {
            const conn = this.connections.get(vin);
            if (!conn) return;

            try {
                console.log(`[${vin}] Scheduled token refresh...`);
                const newSession = await getMqttCredentials(vin);
                conn.session = newSession;
                console.log(`[${vin}] Token refreshed successfully`);

                // Reconnect with new tokens
                if (conn.client) {
                    conn.client.end();
                }
                this.connectMqtt(conn);

            } catch (error: any) {
                console.error(`[${vin}] Scheduled token refresh failed:`, error.message);
            }
        }, config.tokenRefreshInterval);
    }

    private disconnectVehicle(vin: string): void {
        const conn = this.connections.get(vin);
        if (!conn) return;

        if (conn.reconnectTimer) {
            clearTimeout(conn.reconnectTimer);
        }
        if (conn.client) {
            conn.client.end();
        }
        if (conn.pushClient) {
            conn.pushClient.end();
        }

        this.connections.delete(vin);
    }

    private healthCheck(): void {
        const now = Date.now();
        let status = `[Health] ${this.connections.size} vehicles: `;

        for (const [vin, conn] of this.connections) {
            const lastEventAgo = Math.round((now - conn.lastEvent) / 1000 / 60);
            const emqStatus = conn.client?.connected ? 'EMQ' : 'emq';
            const pushStatus = conn.pushClient?.connected ? 'PUSH' : 'push';
            status += `${vin.slice(-6)}:[${emqStatus}/${pushStatus}](${lastEventAgo}m) `;
        }

        console.log(status);
    }

    stop(): void {
        console.log('Shutting down...');

        if (this.unsubscribe) {
            this.unsubscribe();
        }

        for (const [vin] of this.connections) {
            this.disconnectVehicle(vin);
        }

        console.log('Shutdown complete');
    }
}

// =============================================================================
// MAIN
// =============================================================================

const manager = new BydMqttManager();

process.on('SIGINT', () => {
    manager.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    manager.stop();
    process.exit(0);
});

manager.start().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
