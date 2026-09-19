/**
 * The ImmersiveSpace is the render surface on visionOS, so ViroXRSceneNavigator opens it on mount.
 * An AR-rooted scene has nothing to put there — ViroARScene cannot mount on that platform — and
 * opening it anyway dims the room around the wearer to show them an empty world.
 *
 * Which of the two a scene is cannot be read from the props; it is settled when it renders. React
 * renders a parent before its children and runs effects the other way round, so the navigator
 * opens a scan as it renders and reads the answer in its mount effect.
 */
import {
  beginSceneRootScan,
  claimImmersiveSpace,
  markARSceneRoot,
  ownsImmersiveSpace,
  releaseImmersiveSpace,
  scheduleImmersiveSpaceExit,
  resetImmersiveSpaceOwner,
  sawARSceneRoot,
} from "../components/VisionOS/ViroImmersiveSpaceGate";

describe("the ImmersiveSpace gate", () => {
  beforeEach(() => beginSceneRootScan());

  it("reports nothing when no AR root rendered, which is when the space should open", () => {
    expect(sawARSceneRoot()).toBe(false);
  });

  it("reports the AR root a scene rendered, which is when it should not", () => {
    markARSceneRoot();
    expect(sawARSceneRoot()).toBe(true);
  });

  it("forgets the previous navigator's answer when a new scan opens", () => {
    markARSceneRoot();
    expect(sawARSceneRoot()).toBe(true);

    // A second navigator mounts with a plain ViroScene: the first one's AR root must not keep
    // its space shut.
    beginSceneRootScan();
    expect(sawARSceneRoot()).toBe(false);
  });

  it("stays marked across several AR roots in one scene", () => {
    markARSceneRoot();
    markARSceneRoot();
    expect(sawARSceneRoot()).toBe(true);
  });
});

/**
 * Ownership of the one ImmersiveSpace, which is the same single-display problem Quest solves with
 * `setVRActive` / `isVRActive`. A screen stack keeps the screen underneath mounted, so two
 * navigators are alive at once and only one is driving the space.
 */
describe("ImmersiveSpace ownership", () => {
  const first = Symbol("first navigator");
  const second = Symbol("second navigator");

  beforeEach(() => {
    resetImmersiveSpaceOwner();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it("gives the space to whoever claimed it", () => {
    claimImmersiveSpace(first);
    expect(ownsImmersiveSpace(first)).toBe(true);
  });

  it("hands it to the navigator that claims it next", () => {
    claimImmersiveSpace(first);
    claimImmersiveSpace(second);
    expect(ownsImmersiveSpace(first)).toBe(false);
    expect(ownsImmersiveSpace(second)).toBe(true);
  });

  it("closes the space only when the last navigator is gone", () => {
    claimImmersiveSpace(first);
    expect(releaseImmersiveSpace(first)).toBe(true);
  });

  it("keeps it open for the navigator still mounted underneath", () => {
    claimImmersiveSpace(first);
    claimImmersiveSpace(second);
    // The one on top unmounts. The wearer should be left with the scene underneath, not an
    // empty room — which is what closing here would give them.
    expect(releaseImmersiveSpace(second)).toBe(false);
    expect(ownsImmersiveSpace(first)).toBe(true);
  });

  it("hands ownership back down the stack, so the one underneath can reopen on resume", () => {
    claimImmersiveSpace(first);
    claimImmersiveSpace(second);
    releaseImmersiveSpace(second);
    expect(ownsImmersiveSpace(first)).toBe(true);
  });

  it("ignores a release from a navigator that never had it", () => {
    claimImmersiveSpace(first);
    expect(releaseImmersiveSpace(second)).toBe(false);
    expect(ownsImmersiveSpace(first)).toBe(true);
  });
});

/**
 * Swapping the scene on a screen unmounts one navigator and mounts the next in the same commit,
 * cleanup first. A close that fires between the two blinks the space, or lands after the reopen
 * and leaves it shut with nothing left to reopen it.
 */
describe("closing the ImmersiveSpace", () => {
  const first = Symbol("first navigator");
  const second = Symbol("second navigator");

  beforeEach(() => {
    resetImmersiveSpaceOwner();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it("closes when nothing claimed it in the meantime", () => {
    const exit = jest.fn();
    claimImmersiveSpace(first);
    releaseImmersiveSpace(first);
    scheduleImmersiveSpaceExit(exit);
    expect(exit).not.toHaveBeenCalled(); // not before the next navigator had its chance
    jest.runAllTimers();
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it("does not close when the next navigator claimed it first", () => {
    const exit = jest.fn();
    claimImmersiveSpace(first);
    releaseImmersiveSpace(first);
    scheduleImmersiveSpaceExit(exit);

    // The replacement mounts, as it does on a keyed swap or a screen change.
    claimImmersiveSpace(second);
    jest.runAllTimers();
    expect(exit).not.toHaveBeenCalled();
    expect(ownsImmersiveSpace(second)).toBe(true);
  });
});
