// BYD Stats - Data Processing Worker
import * as Comlink from 'comlink';
import { processData } from '../core/dataProcessing';

const api = { processData };

Comlink.expose(api);
