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
import { md5Hex, aesDecryptUtf8 } from './crypto';

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
    session: BydSession | null;
    lastEvent: number;
    reconnectTimer: NodeJS.Timeout | null;
}

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
                session,
                lastEvent: Date.now(),
                reconnectTimer: null,
            };

            this.connections.set(vin, conn);

            // Connect MQTT
            this.connectMqtt(conn);

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

        // pyBYD password format:
        // base = signToken + clientId + userId + timestamp
        // password = timestamp + md5(base)
        const base = signToken + clientId + userId + timestamp;
        const password = timestamp + md5Hex(base).toLowerCase();

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
            console.log(`[${conn.vin}] MQTT connected! Activating polling...`);

            // Activate polling in Firestore - car is online!
            this.activatePolling(conn.vin);

            const topic = `oversea/res/${userId}`;
            client.subscribe(topic, { qos: 0 }, (err) => {
                if (err) {
                    console.error(`[${conn.vin}] Subscribe failed:`, err);
                } else {
                    console.log(`[${conn.vin}] Subscribed to ${topic}`);
                }
            });
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

    private handleMessage(conn: VehicleConnection, topic: string, message: Buffer): void {
        conn.lastEvent = Date.now();

        try {
            let payload: any;
            const messageStr = message.toString();

            // Decrypt if hex-encoded
            if (/^[0-9A-Fa-f]+$/.test(messageStr) && messageStr.length > 100) {
                const decryptKey = md5Hex(conn.session!.encryToken);
                const decrypted = aesDecryptUtf8(messageStr, decryptKey);
                payload = JSON.parse(decrypted);
            } else {
                payload = JSON.parse(messageStr);
            }

            console.log(`[${conn.vin}] Event: ${payload.event || 'unknown'}`);

            // Forward to Firestore
            this.forwardEvent(conn.vin, payload);

        } catch (error: any) {
            console.error(`[${conn.vin}] Message handling error:`, error.message);
        }
    }

    private async forwardEvent(vin: string, payload: any): Promise<void> {
        try {
            // Write to Firestore events collection
            await db.collection('bydEvents').add({
                vin,
                event: payload.event,
                data: payload.data || payload.respondData || payload,
                receivedAt: admin.firestore.Timestamp.now(),
                processed: false,
            });

            // Also update vehicle state directly
            if (payload.event === 'vehicleInfo') {
                const data = payload.data?.respondData || payload.data || {};
                await db.collection('bydVehicles').doc(vin).update({
                    lastSoC: (data.elecPercent || 0) / 100,
                    lastRange: data.evEndurance || 0,
                    lastOdometer: data.odo || data.mileage || 0,
                    isCharging: data.chargeState === 1,
                    isOnline: true,
                    lastMqttUpdate: admin.firestore.Timestamp.now(),
                });
            }

            console.log(`[${vin}] Event forwarded to Firestore`);

        } catch (error: any) {
            console.error(`[${vin}] Failed to forward event:`, error.message);
        }
    }

    /**
     * Activate polling for a vehicle when MQTT connects
     * This signals Firebase that the car is online and should be polled
     */
    private async activatePolling(vin: string): Promise<void> {
        try {
            await db.collection('bydVehicles').doc(vin).update({
                pollingActive: true,
                isOnline: true,
                mqttConnected: true,
                lastMqttConnect: admin.firestore.Timestamp.now(),
                stationaryPollCount: 0, // Reset counter
            });
            console.log(`[${vin}] Polling activated - car is online!`);
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

        this.connections.delete(vin);
    }

    private healthCheck(): void {
        const now = Date.now();
        let status = `[Health] ${this.connections.size} connections: `;

        for (const [vin, conn] of this.connections) {
            const lastEventAgo = Math.round((now - conn.lastEvent) / 1000 / 60);
            const connected = conn.client?.connected ? 'OK' : 'DISC';
            status += `${vin.slice(-6)}:${connected}(${lastEventAgo}m) `;
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
