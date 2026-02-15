"use strict";
/**
 * BYD API Module
 * Direct access to BYD vehicle API without Smartcar
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.md5HexLower = exports.md5Hex = exports.areBangcleTablesLoaded = exports.loadBangcleTables = exports.BydClient = void 0;
exports.initBydModule = initBydModule;
var client_1 = require("./client");
Object.defineProperty(exports, "BydClient", { enumerable: true, get: function () { return client_1.BydClient; } });
var crypto_1 = require("./crypto");
Object.defineProperty(exports, "loadBangcleTables", { enumerable: true, get: function () { return crypto_1.loadBangcleTables; } });
Object.defineProperty(exports, "areBangcleTablesLoaded", { enumerable: true, get: function () { return crypto_1.areBangcleTablesLoaded; } });
Object.defineProperty(exports, "md5Hex", { enumerable: true, get: function () { return crypto_1.md5Hex; } });
Object.defineProperty(exports, "md5HexLower", { enumerable: true, get: function () { return crypto_1.md5HexLower; } });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_2 = require("./crypto");
/**
 * Initialize BYD module by loading crypto tables
 * Call this once at startup before using BydClient
 */
function initBydModule() {
    if ((0, crypto_2.areBangcleTablesLoaded)()) {
        return;
    }
    const tablesPath = path.join(__dirname, 'bangcle_tables.bin');
    const tablesData = fs.readFileSync(tablesPath);
    (0, crypto_2.loadBangcleTables)(tablesData);
}
//# sourceMappingURL=index.js.map