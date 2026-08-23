const mockRvStudioApiRequest = jest.fn();

jest.mock("react-native", () => ({
  NativeModules: {
    VRTStudio: {
      rvStudioApiRequest: (bodyJson: string) => mockRvStudioApiRequest(bodyJson),
    },
  },
}));

import { defaultApiRequestExecutor } from "../components/Studio/domain/defaultApiRequestExecutor";

beforeEach(() => {
  mockRvStudioApiRequest.mockReset();
});

describe("defaultApiRequestExecutor", () => {
  test("serialises {function_id, variables} and maps a success envelope", async () => {
    mockRvStudioApiRequest.mockResolvedValue({
      success: true,
      data: JSON.stringify({
        ok: true,
        status: 200,
        content_type: "application/json",
        body: { items: [1, 2] },
        latency_ms: 87,
        meta: { request_id: "r-1" },
      }),
    });

    const outcome = await defaultApiRequestExecutor("fn-1", {
      userId: 42,
      active: true,
    });

    expect(mockRvStudioApiRequest).toHaveBeenCalledWith(
      JSON.stringify({ function_id: "fn-1", variables: { userId: 42, active: true } }),
    );
    expect(outcome).toEqual({
      ok: true,
      status: 200,
      body: { items: [1, 2] },
      error_code: null,
      error_message: null,
    });
  });

  test("passes a failure envelope through (upstream failures are HTTP 200)", async () => {
    mockRvStudioApiRequest.mockResolvedValue({
      success: true,
      data: JSON.stringify({
        ok: false,
        status: null,
        error_code: "TIMEOUT",
        error_message: "Request timed out",
      }),
    });

    const outcome = await defaultApiRequestExecutor("fn-1", {});

    expect(outcome.ok).toBe(false);
    expect(outcome.status).toBeNull();
    expect(outcome.error_code).toBe("TIMEOUT");
    expect(outcome.error_message).toBe("Request timed out");
  });

  test("maps a proxy error response to NETWORK_ERROR with the proxy's message", async () => {
    mockRvStudioApiRequest.mockResolvedValue({
      success: false,
      error: JSON.stringify({
        error: { code: "API_REQUEST_LIMIT_REACHED", message: "Monthly limit reached" },
        meta: { request_id: "r-2" },
      }),
    });

    const outcome = await defaultApiRequestExecutor("fn-1", {});

    expect(outcome).toEqual({
      ok: false,
      status: null,
      error_code: "NETWORK_ERROR",
      error_message: "Monthly limit reached",
    });
  });

  test("maps a plain transport error string to NETWORK_ERROR", async () => {
    mockRvStudioApiRequest.mockResolvedValue({
      success: false,
      error: "RVApiKey not set in Info.plist",
    });

    const outcome = await defaultApiRequestExecutor("fn-1", {});

    expect(outcome.ok).toBe(false);
    expect(outcome.error_code).toBe("NETWORK_ERROR");
    expect(outcome.error_message).toBe("RVApiKey not set in Info.plist");
  });

  test("maps an unparseable envelope to NETWORK_ERROR", async () => {
    mockRvStudioApiRequest.mockResolvedValue({ success: true, data: "<html>oops" });

    const outcome = await defaultApiRequestExecutor("fn-1", {});

    expect(outcome.ok).toBe(false);
    expect(outcome.error_code).toBe("NETWORK_ERROR");
    expect(outcome.error_message).toBe("Malformed scene-api-request response");
  });
});
