/**
 * BYD API Module
 * Direct access to BYD vehicle API
 */

export { BydClient } from './client';
export type {
    BydConfig,
    AuthToken,
    BydSession,
    BydVehicle,
    BydRealtime,
    BydGps,
    BydCharging
} from './client';

export {
    loadBangcleTables,
    areBangcleTablesLoaded,
    md5Hex,
    md5HexLower
} from './crypto';

import * as fs from 'fs';
import * as path from 'path';
import { loadBangcleTables, areBangcleTablesLoaded } from './crypto';

/**
 * Initialize BYD module by loading crypto tables
 * Call this once at startup before using BydClient
 */
export function initBydModule(): void {
    if (areBangcleTablesLoaded()) {
        return;
    }

    const tablesPath = path.join(__dirname, 'bangcle_tables.bin');
    const tablesData = fs.readFileSync(tablesPath);
    loadBangcleTables(tablesData);
}
