/**
 * Global type declarations for Viro Fabric Interop
 */

declare global {
  var registerViroEventCallback:
    | ((callbackId: string, handler: any) => void)
    | undefined;
  var handleViroEvent:
    | ((callbackId: string, eventData: any) => void)
    | undefined;
}

export {};
