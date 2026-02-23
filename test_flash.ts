import { initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';

const app = initializeApp({
    projectId: 'REDACTED_FIREBASE_PROJECT_ID'
});

const functions = getFunctions(app, 'europe-west1');

async function testRemoteControl() {
    const bydFlashLights = httpsCallable(functions, 'bydFlashLightsV2');

    try {
        console.log('Calling bydFlashLightsV2...');
        const result = await bydFlashLights({
            vin: process.argv[2] // Pass VIN as argument
        });
        console.log('Result:', result.data);
    } catch (e: any) {
        console.error('Error:', e.message);
    }
}

testRemoteControl();
