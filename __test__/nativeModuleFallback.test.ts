/**
 * A whole native subsystem can be absent by design — the AR modules are excluded from the visionOS
 * renderer — and `NativeModules.X` is then null. Guarding `render` is not enough: lifecycle and
 * imperative methods still run, and `componentWillUnmount` calling `cleanup` on null crashed the
 * app with a message that named none of this.
 */
import {
  withMissingModuleFallback,
  resetMissingModuleWarnings,
} from "../components/Utilities/ViroNativeModule";

describe("withMissingModuleFallback", () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    resetMissingModuleWarnings();
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => warn.mockRestore());

  it("hands back the real module untouched when it is registered", () => {
    const real = { cleanup: jest.fn() };
    expect(withMissingModuleFallback(real, "VRTARSceneNavigatorModule")).toBe(real);
  });

  it("stands in for a null module instead of throwing on the first call", async () => {
    const stub = withMissingModuleFallback<{ cleanup: (tag: number) => Promise<void> }>(
      null,
      "VRTARSceneNavigatorModule"
    );
    await expect(stub.cleanup(7)).resolves.toBeUndefined();
  });

  it("resolves rather than rejects, because most of these calls are never awaited", async () => {
    const stub = withMissingModuleFallback<{ fire: () => Promise<void> }>(
      undefined,
      "VRTARSceneNavigatorModule"
    );
    const rejection = jest.fn();
    stub.fire().catch(rejection);
    await Promise.resolve();
    expect(rejection).not.toHaveBeenCalled();
  });

  it("names the module and method once, however many times it is called", () => {
    const stub = withMissingModuleFallback<{ cleanup: () => void }>(
      null,
      "VRTARSceneNavigatorModule"
    );
    stub.cleanup();
    stub.cleanup();
    stub.cleanup();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      "[Viro] VRTARSceneNavigatorModule.cleanup is not available on this platform; the call did nothing."
    );
  });

  it("keeps the methods apart, so one silenced warning does not hide another", () => {
    const stub = withMissingModuleFallback<{
      cleanup: () => void;
      takeScreenshot: () => void;
    }>(null, "VRTARSceneNavigatorModule");
    stub.cleanup();
    stub.takeScreenshot();
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("is not mistaken for a promise when something awaits the module itself", async () => {
    const stub = withMissingModuleFallback<Record<string, unknown>>(null, "X");
    await expect(Promise.resolve(stub)).resolves.toBe(stub);
  });
});
