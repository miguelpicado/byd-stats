const admin = require('firebase-admin');
const crypto = require('crypto');
require('dotenv').config();

const app = admin.initializeApp({ projectId: 'REDACTED_FIREBASE_PROJECT_ID' });
const db = admin.firestore();
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
    console.error('ERROR: TOKEN_ENCRYPTION_KEY is not set. Add it to functions/.env');
    process.exit(1);
}

async function main() {
    const vehiclesSnapshot = await db.collection('bydVehicles').limit(1).get();
    if (vehiclesSnapshot.empty) return;
    const vin = vehiclesSnapshot.docs[0].id;
    const credsRef = db.collection('bydVehicles').doc(vin).collection('private').doc('credentials');
    const doc = await credsRef.get();

    if (!doc.exists) return;
    const creds = doc.data();

    const decrypt = (encrypted) => {
        const [ivHex, authTagHex, dataHex] = encrypted.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const data = Buffer.from(dataHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
        decipher.setAuthTag(authTag);
        return decipher.update(data, undefined, 'utf8') + decipher.final('utf8');
    };

    console.log("Username:", decrypt(creds.username));
    console.log("Password:", decrypt(creds.password));
}

main().then(() => process.exit(0)).catch(console.error);
