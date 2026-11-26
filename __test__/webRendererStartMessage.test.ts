import { webRendererStartMessage } from "../components/Web/viroStartError";

describe("webRendererStartMessage", () => {
  it("names a browser without WebGL2", () => {
    const err = Object.assign(new Error(), { name: "ViroWebGLUnavailableError", reason: "unsupported" });
    expect(webRendererStartMessage(err)).toBe("This browser cannot show 3D content: WebGL2 is unavailable.");
  });

  it("asks for a reload when the context was lost before the start", () => {
    const err = Object.assign(new Error(), { name: "ViroWebGLUnavailableError", reason: "context-lost" });
    expect(webRendererStartMessage(err)).toMatch(/Reload the page/);
  });

  // What a renderer from before the typed error rejects with.
  it("falls back for any other failure", () => {
    const err = Object.assign(new Error("unreachable"), { name: "RuntimeError" });
    expect(webRendererStartMessage(err)).toBe("Could not initialize the renderer.");
    expect(webRendererStartMessage(undefined)).toBe("Could not initialize the renderer.");
  });
});
