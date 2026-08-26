import { StudioApiRequestExecutor, StudioApiRequestOutcome } from "../types";
import { VRTStudioModule } from "../VRTStudioModule";

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
export const defaultApiRequestExecutor: StudioApiRequestExecutor = async (
  functionId,
  variables,
) => {
  const result = await VRTStudioModule.rvStudioApiRequest(
    JSON.stringify({ function_id: functionId, variables }),
  );

  if (!result.success || typeof result.data !== "string") {
    return failureOutcome(extractErrorMessage(result.error));
  }

  try {
    const envelope = JSON.parse(result.data) as Partial<StudioApiRequestOutcome>;
    return {
      ok: envelope.ok === true,
      status: typeof envelope.status === "number" ? envelope.status : null,
      body: envelope.body,
      error_code: envelope.error_code ?? null,
      error_message: envelope.error_message ?? null,
    };
  } catch {
    return failureOutcome("Malformed scene-api-request response");
  }
};

function failureOutcome(message: string): StudioApiRequestOutcome {
  return {
    ok: false,
    status: null,
    error_code: "NETWORK_ERROR",
    error_message: message,
  };
}

/** Proxy auth/contract errors arrive as {"error":{"code","message"}} JSON. */
function extractErrorMessage(error: string | undefined): string {
  if (!error) return "Request failed";
  try {
    const parsed = JSON.parse(error) as { error?: { message?: string } };
    if (typeof parsed.error?.message === "string") return parsed.error.message;
  } catch {
    // not JSON — use the raw transport error
  }
  return error;
}
