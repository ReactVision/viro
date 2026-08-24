import {
  isStudioApiError,
  studioApiError,
} from "../components/Studio/domain/studioApiError";

/** The native module funnels every failure shape into one `error` string. */
const ENVELOPE = JSON.stringify({
  error: { code: "PROJECT_ACCESS_DENIED", message: "No access to this scene" },
  meta: { request_id: "req_1" },
});

describe("studioApiError", () => {
  it("lifts code and detail out of a response envelope", () => {
    const error = studioApiError("rvGetScene", ENVELOPE);
    expect(error.code).toBe("PROJECT_ACCESS_DENIED");
    expect(error.detail).toBe("No access to this scene");
    expect(error.body).toBe(ENVELOPE);
    expect(error.status).toBeNull();
  });

  it("keeps the message stable and free of the response body", () => {
    const error = studioApiError("rvGetScene", ENVELOPE);
    expect(error.message).toBe("rvGetScene failed: PROJECT_ACCESS_DENIED");
    expect(error.message).not.toContain("request_id");
  });

  it("parses an envelope that carries a prefix", () => {
    expect(studioApiError("rvGetScene", `HTTP 403 ${ENVELOPE}`).code).toBe(
      "PROJECT_ACCESS_DENIED"
    );
  });

  // A transport description is localised on iOS, so it must never be matched
  // on, only carried through.
  it("carries a transport description without inventing a code", () => {
    const message = "The internet connection appears to be offline.";
    const error = studioApiError("rvGetScene", message);
    expect(error.code).toBeNull();
    expect(error.detail).toBeNull();
    expect(error.body).toBe(message);
    expect(error.message).toBe("rvGetScene failed");
  });

  it("reads the status off a bare status line", () => {
    const error = studioApiError("rvGetScene", "HTTP 403");
    expect(error.status).toBe(403);
    expect(error.code).toBeNull();
  });

  it("survives a truncated or code-less envelope", () => {
    expect(studioApiError("rvGetScene", '{"error":{"messa').code).toBeNull();
    expect(
      studioApiError("rvGetScene", '{"error":{"message":"no code"}}').code
    ).toBeNull();
    expect(
      studioApiError("rvGetScene", '{"error":{"message":"no code"}}').detail
    ).toBe("no code");
  });

  it("handles a missing native error", () => {
    for (const input of [undefined, null, "", "   "]) {
      const error = studioApiError("rvGetProject", input);
      expect(error.message).toBe("rvGetProject failed");
      expect(error.body).toBeNull();
    }
  });

  it("is recognised structurally", () => {
    expect(isStudioApiError(studioApiError("rvGetScene", ENVELOPE))).toBe(true);
    expect(isStudioApiError(new Error("rvGetScene failed"))).toBe(false);
    expect(isStudioApiError("not an error")).toBe(false);
    expect(isStudioApiError(null)).toBe(false);
  });
});
