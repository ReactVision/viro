/**
 * The AR view managers are excluded from the visionOS renderer, so the components that mount them
 * must decide in JS. A missing view manager does not render nothing — it takes the app down.
 */
import { warnUnsupported, resetUnsupportedWarnings } from "../components/Utilities/ViroUnsupported";

describe("warnUnsupported", () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    resetUnsupportedWarnings();
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => warn.mockRestore());

  it("warns once per component and platform, however many times it is called", () => {
    warnUnsupported("ViroARScene", "Apple Vision Pro");
    warnUnsupported("ViroARScene", "Apple Vision Pro");
    warnUnsupported("ViroARScene", "Apple Vision Pro");
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("keeps the components apart, so one silenced warning does not hide another", () => {
    warnUnsupported("ViroARScene", "Apple Vision Pro");
    warnUnsupported("ViroARPlane", "Apple Vision Pro");
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("keeps the platforms apart", () => {
    warnUnsupported("ViroARScene", "Apple Vision Pro");
    warnUnsupported("ViroARScene", "Meta Quest");
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("names the alternative when there is one, and stays terse when there is not", () => {
    warnUnsupported("ViroARScene", "Apple Vision Pro", "Use ViroScene instead.");
    expect(warn).toHaveBeenCalledWith(
      "[Viro] ViroARScene is not supported on Apple Vision Pro. Use ViroScene instead."
    );

    resetUnsupportedWarnings();
    warn.mockClear();
    warnUnsupported("ViroARPlane", "Apple Vision Pro");
    expect(warn).toHaveBeenCalledWith(
      "[Viro] ViroARPlane is not supported on Apple Vision Pro."
    );
  });
});
