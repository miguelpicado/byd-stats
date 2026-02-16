const axios = require('axios');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const PROJECT_ID = 'REDACTED_FIREBASE_PROJECT_ID';
const REGION = 'europe-west1';
const FUNCTION_NAME = 'bydFixTrip';
const URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${FUNCTION_NAME}`;

console.log('--- BYD Trip Fixer ---');
console.log(`Target Function: ${URL}`);

rl.question('Enter VIN: ', (vin) => {
    rl.question('Enter Trip ID: ', (tripId) => {

        console.log(`\nFixing trip ${tripId} for VIN ${vin}...`);

        axios.post(URL, {
            data: {
                vin: vin.trim(),
                tripId: tripId.trim()
            }
        })
            .then(response => {
                console.log('\nSUCCESS!');
                const result = response.data.result || {};

                if (result.analysis) {
                    console.log('\n--- TRIP ANALYSIS ---');
                    console.log(JSON.stringify(result.analysis, null, 2));
                    console.log('---------------------');
                }

                if (result.updates) {
                    console.log('\nUpdates Applied:', JSON.stringify(result.updates, null, 2));
                } else {
                    console.log('\nMessage:', result.message || 'No updates needed');
                }

                rl.close();
            })
            .catch(error => {
                console.error('\nERROR:');
                if (error.response) {
                    console.error(`Status: ${error.response.status}`);
                    console.error('Data:', JSON.stringify(error.response.data, null, 2));
                } else {
                    console.error(error.message);
                }
                rl.close();
            });
    });
});
