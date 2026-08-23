import { StudioApiRequestExecutor } from "../types";
/**
 * Built-in API_REQUEST transport for production Viro apps: POSTs
 * {function_id, variables} to the scene-api-request egress proxy through the
 * native module, authenticated with the app's RVApiKey (same credential used
 * to fetch scenes). Hosts with their own transport (e.g. StudioGo's JWT
 * controller) override it via runtimeCtx.
 *
 * Always resolves with an outcome — transport-level problems (native module
 * missing, RVApiKey unset, proxy auth/limit errors, malformed envelope)
 * become a NETWORK_ERROR failure so the scene routes to the failure arm
 * instead of crashing.
 */
export declare const defaultApiRequestExecutor: StudioApiRequestExecutor;
