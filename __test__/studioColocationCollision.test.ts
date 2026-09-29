// The dispatcher imports react-native and native modules; mock them as the
// scene-function walker suite does.
jest.mock("react-native", () => ({
  Alert: { alert: jest.fn() },
  AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
  Platform: { OS: "ios" },
}));
jest.mock("../components/Utilities/ViroPlatform", () => ({ isQuest: false }));
jest.mock("../components/Studio/VRTStudioModule", () => ({
  VRTStudioModule: { rvGetScene: jest.fn() },
}));

import type { StudioColocationFrame } from "../components/Studio/colocation/controller";
import { collisionBindingsRunHere } from "../components/Studio/colocation/sharedState";
import { createPlacementCollisionHandler } from "../components/Studio/domain/collisionBindingsRuntime";
import { collisionPairKey } from "../components/Studio/domain/collisionPairKey";
import { SequenceScheduler } from "../components/Studio/domain/sceneNavigationHandler";
import { StudioVariableStore } from "../components/Studio/domain/variableStore";
import type {
  StudioCollisionBinding,
  StudioSceneFunction,
} from "../components/Studio/types";

const frame = (
  over: Partial<StudioColocationFrame> = {}
): StudioColocationFrame => ({
  phase: "off",
  role: null,
  needsOrigin: false,
  sceneId: null,
  sceneMount: null,
  location: null,
  origin: null,
  sceneToWorld: null,
  worldToScene: null,
  ...over,
});

describe("collisionBindingsRunHere", () => {
  it.each([
    ["alone", frame(), true],
    ["setting up", frame({ phase: "pending", role: "join" }), true],
    ["shared, host", frame({ phase: "shared", role: "host" }), true],
    ["shared, joined", frame({ phase: "shared", role: "join" }), false],
  ])("%s", (_label, f, expected) => {
    expect(collisionBindingsRunHere(f)).toBe(expected);
  });
});

describe("collision bindings in a shared session", () => {
  const countHit = {
    id: "fn-1",
    scene: "scene-1",
    function_type: "SET_VARIABLE",
    scene_set_variable: {
      id: "sv-1",
      variable_id: "var-1",
      name: "hits",
      type: "NUMBER",
      expression: "hits + 1",
    },
  } as unknown as StudioSceneFunction;
  const binding = {
    id: "b-1",
    scene_id: "scene-1",
    function_id: "fn-1",
    asset_x_id: "ball",
    asset_y_id: "goal",
    scene_function: countHit,
  } as StudioCollisionBinding;

  function contact(current: { frame: StudioColocationFrame }) {
    const store = new StudioVariableStore();
    store.seed([
      { id: "var-1", name: "hits", type: "NUMBER", initial_value: 0 },
    ]);
    const scheduler = new SequenceScheduler();
    const handler = createPlacementCollisionHandler(
      "ball",
      new Map([[collisionPairKey("ball", "goal"), [binding]]]),
      undefined,
      [],
      { current: new Map() },
      undefined,
      undefined,
      { scheduler, variableStore: store },
      () => collisionBindingsRunHere(current.frame)
    );
    return { store, hit: () => handler("goal", [0, 0, 0], [0, 1, 0]) };
  }

  it("runs a binding on the host and not on a device that joined", () => {
    const host = contact({ frame: frame({ phase: "shared", role: "host" }) });
    const joined = contact({ frame: frame({ phase: "shared", role: "join" }) });
    host.hit();
    joined.hit();
    expect(host.store.get("hits")).toBe(1);
    expect(joined.store.get("hits")).toBe(0);
  });

  it("does not start the cooldown for a contact it dropped", () => {
    const current = { frame: frame({ phase: "shared", role: "join" }) };
    const device = contact(current);
    device.hit();
    // The session ended: the next contact runs at once.
    current.frame = frame();
    device.hit();
    expect(device.store.get("hits")).toBe(1);
  });
});
