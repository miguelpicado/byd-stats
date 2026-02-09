const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

exports.queryRecentTrips = async (req, res) => {
    try {
        const feb3Start = new Date('2026-02-03T00:00:00Z');
        const feb5Start = new Date('2026-02-05T00:00:00Z');

        const tripsSnapshot = await db.collection('trips')
            .where('startDate', '>=', admin.firestore.Timestamp.fromDate(feb3Start))
            .where('startDate', '<', admin.firestore.Timestamp.fromDate(feb5Start))
            .orderBy('startDate', 'asc')
            .get();

        const trips = [];
        tripsSnapshot.forEach((doc) => {
            const data = doc.data();
            trips.push({
                id: doc.id,
                ...data,
                startDate: data.startDate?.toDate().toISOString(),
                endDate: data.endDate?.toDate().toISOString(),
                lastUpdate: data.lastUpdate?.toDate().toISOString(),
                startDateLocal: data.startDate?.toDate().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
                endDateLocal: data.endDate?.toDate().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
            });
        });

        res.status(200).json({
            total: trips.length,
            trips: trips
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
