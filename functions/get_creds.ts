import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

const app = admin.initializeApp({ projectId: 'REDACTED_FIREBASE_PROJECT_ID' });
const db = admin.firestore();
const ENCRYPTION_KEY = 'd0a5edbd5edc9a1bb954e16cdb4c9391673081a5e0e44554018b4fbd08889661';

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
