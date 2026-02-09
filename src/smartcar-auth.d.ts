declare module '@smartcar/auth' {
    export interface SmartcarAuthOptions {
        clientId: string;
        redirectUri: string;
        scope: string[];
        testMode?: boolean;
        mode?: 'live' | 'test';
        onComplete?: (err: any, code: string | null) => void;
    }

    export default class SmartcarAuth {
        constructor(options: SmartcarAuthOptions);
        openDialog(options?: { forceApproval?: boolean }): void;
    }
}
