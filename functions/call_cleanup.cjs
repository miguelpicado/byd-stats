// Call the cleanup function via Firebase callable
const https = require('https');

const projectId = 'REDACTED_FIREBASE_PROJECT_ID';
const region = 'europe-west1';
const functionName = 'cleanupDuplicateTrips';

// First do a dry run
const data = JSON.stringify({ data: { dryRun: true } });

const options = {
    hostname: `${region}-${projectId}.cloudfunctions.net`,
    path: `/${functionName}`,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

console.log('Calling cleanup function (dryRun=true)...');

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response:', body);
    });
});

req.on('error', (e) => {
    console.error('Error:', e);
});

req.write(data);
req.end();
