import * as admin from 'firebase-admin';

admin.initializeApp({
    projectId: "migue-byd" // The frontend config uses migue-byd, wait let me check the existing functions.
});
const db = admin.firestore();

async function run() {
    // We assume emulator is not running, we must connect to production using credential?
    // Oh, better yet, I can just use the emulator if it's running, or ask the user to reconnect.
}
