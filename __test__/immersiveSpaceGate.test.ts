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

  beforeEach(() => resetImmersiveSpaceOwner());

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

  it("closes the space for the owner on the way out", () => {
    claimImmersiveSpace(first);
    expect(releaseImmersiveSpace(first)).toBe(true);
  });

  it("does not close it for a navigator that has since been superseded", () => {
    claimImmersiveSpace(first);
    claimImmersiveSpace(second);
    // The screen underneath unmounts after the one on top opened its own scene. Closing here
    // would blank what the wearer is looking at.
    expect(releaseImmersiveSpace(first)).toBe(false);
    expect(ownsImmersiveSpace(second)).toBe(true);
  });

  it("leaves nobody owning it once the owner is gone, so a stale reopen cannot fire", () => {
    claimImmersiveSpace(first);
    releaseImmersiveSpace(first);
    expect(ownsImmersiveSpace(first)).toBe(false);
  });
});
