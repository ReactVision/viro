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
  markARSceneRoot,
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
