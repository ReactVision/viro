export declare class ViroTelemetry {
    private static _isDisabled;
    private static _isDebugging;
    private static _telemetryUrl;
    private static _timeout;
    /**
     * Allow a user to start debugging the telemetry to see what is sent.
     */
    static setDebugging(): void;
    /**
     * Allow a user to opt out of telemetry.
     */
    static optOutTelemetry(): void;
    static recordTelemetry(eventName: string, payload?: any): void;
    private static getAnonymousMeta;
}
