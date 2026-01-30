// BYD Stats - Data Processing Worker
import * as Comlink from 'comlink';
import { processData } from '../core/dataProcessing';

// Expose the processData function to the main thread
Comlink.expose({
    processData
});
