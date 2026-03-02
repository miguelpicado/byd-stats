import { Charge, Settings } from '@/types';

export interface ParseChargeResult {
    chargesArray: Charge[];
    newChargerTypes: Array<{
        id: string;
        name: string;
        speedKw: number;
        efficiency: number;
    }>;
}

export async function parseChargeRegistry(file: File, settings: Settings): Promise<ParseChargeResult> {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
        throw new Error('errors.noDataFound');
    }

    const chargesArray: any[] = [];
    const newChargerTypes: Array<{
        id: string;
        name: string;
        speedKw: number;
        efficiency: number;
    }> = [];
    const existingChargerNames = new Set(
        (settings.chargerTypes || []).map(ct => ct.name.toLowerCase())
    );

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const values = line.match(/("[^"]*"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, '').trim());

        if (!values || values.length < 8) continue;
        const [fechaHora, kmTotales, kwhFacturados, precioTotal, , tipoCargador, precioKw, porcentajeFinal] = values;

        if (!fechaHora || !fechaHora.match(/^\d{4}-\d{2}-\d{2}/)) break;

        const dateMatch = fechaHora.match(/(\d{4}-\d{2}-\d{2})\s*(\d{2}:\d{2})/);
        if (!dateMatch) continue;

        const date = dateMatch[1];
        const time = dateMatch[2];

        let chargerTypeId: string | null = null;
        const chargerName = tipoCargador?.trim();

        if (chargerName) {
            const existing = (settings.chargerTypes || []).find(
                ct => ct.name.toLowerCase() === chargerName.toLowerCase()
            );

            if (existing) {
                chargerTypeId = existing.id;
            } else if (!existingChargerNames.has(chargerName.toLowerCase())) {
                const newId = `csv_${Date.now()}_${i}`;
                newChargerTypes.push({
                    id: newId,
                    name: chargerName,
                    speedKw: 11,
                    efficiency: 1
                });
                chargerTypeId = newId;
                existingChargerNames.add(chargerName.toLowerCase());
            } else {
                chargerTypeId = newChargerTypes.find(
                    ct => ct.name.toLowerCase() === chargerName.toLowerCase()
                )?.id || null;
            }
        }

        chargesArray.push({
            date,
            time,
            odometer: parseFloat(kmTotales) || 0,
            kwhCharged: parseFloat(kwhFacturados) || 0,
            totalCost: parseFloat(precioTotal) || 0,
            chargerTypeId: chargerTypeId || '',
            pricePerKwh: parseFloat(precioKw) || 0,
            finalPercentage: parseFloat(porcentajeFinal) || 0
        });
    }

    return { chargesArray, newChargerTypes };
}
