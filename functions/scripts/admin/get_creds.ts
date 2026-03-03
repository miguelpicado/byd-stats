import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

const app = admin.initializeApp({ projectId: 'REDACTED_FIREBASE_PROJECT_ID' });
const db = admin.firestore();
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
    console.error('ERROR: TOKEN_ENCRYPTION_KEY is not set. Add it to functions/.env');
    process.exit(1);
}

async function main() {
    console.log("Fetching credentials...");
    const credsRef = db.collection('bydVehicles').doc('LC0CD4EA5R1000845').collection('private').doc('credentials');
    const doc = await credsRef.get();

    if (!doc.exists) {
        console.log("No credentials found");
        return;
    }

    const creds = doc.data()!;

    const decrypt = (encrypted: string) => {
        const [ivHex, authTagHex, dataHex] = encrypted.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const data = Buffer.from(dataHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
        decipher.setAuthTag(authTag);
        return decipher.update(data, undefined, 'utf8') + decipher.final('utf8');
    };

    console.log("Password:", decrypt(creds.password));
    console.log("Control PIN:", creds.controlPin ? decrypt(creds.controlPin) : 'Not found');
}

main().catch(console.error);
