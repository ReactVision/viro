// The walker imports react-native + native modules; mock them so the suite
// stays in the pure-module jest config the rest of __test__ relies on.
jest.mock("react-native", () => ({
  Alert: { alert: jest.fn() },
  AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
}));
jest.mock("../components/Utilities/ViroPlatform", () => ({ isQuest: false }));
jest.mock("../components/Studio/VRTStudioModule", () => ({
  VRTStudioModule: { rvGetScene: jest.fn() },
}));

import {
  executeFunctionWithRelations,
  SequenceScheduler,
  type SequenceRuntimeContext,
} from "../components/Studio/domain/sceneNavigationHandler";
import { StudioVariableStore } from "../components/Studio/domain/variableStore";
import type {
  StudioBranchCondition,
  StudioSceneFunction,
  StudioSequence,
  StudioSequenceStep,
} from "../components/Studio/types";

// ── Fixture builders ──────────────────────────────────────────────────────
// Arms use only SET_VARIABLE steps so the whole walk runs synchronously (no
// scheduler timers), letting tests assert store state right after dispatch.

const baseFn = (id: string): StudioSceneFunction => ({
  id,
  scene: "scene-1",
  function_type: "SET_VARIABLE",
  navigation: null,
  alert: null,
  animation: null,
  sequence: null,
  set_variable: null,
  branch: null,
  api_request: null,
  scene_navigation: null,
  scene_alert: null,
  scene_animation: null,
  scene_sequence: null,
  scene_set_variable: null,
  scene_branch: null,
  scene_api_request: null,
});

const setVarFn = (
  id: string,
  name: string,
  expression: string,
): StudioSceneFunction => ({
  ...baseFn(id),
  function_type: "SET_VARIABLE",
  set_variable: `${id}-sv`,
  scene_set_variable: {
    id: `${id}-sv`,
    variable_id: `${name}-var`,
    name,
    type: "NUMBER",
    expression,
  },
});

const navFn = (id: string): StudioSceneFunction => ({
  ...baseFn(id),
  function_type: "NAVIGATION",
  navigation: `${id}-nav`,
  scene_navigation: { id: `${id}-nav`, navigate_to: "scene-2" },
});

const seqOf = (id: string, fns: StudioSceneFunction[]): StudioSequence => ({
  id,
  name: null,
  steps: fns.map((f, i) => ({
    id: `${id}-step-${i}`,
    step_order: i,
    step_type: "ACTION" as const,
    duration_ms: null,
    function_id: f.id,
    function: f,
  })),
});

const seqFn = (id: string, fns: StudioSceneFunction[]): StudioSceneFunction => ({
  ...baseFn(id),
  function_type: "SEQUENCE",
  sequence: `${id}-seq`,
  scene_sequence: seqOf(`${id}-seq`, fns),
});

const actionStep = (
  order: number,
  fn: StudioSceneFunction
): StudioSequenceStep => ({
  id: `step-${order}-${fn.id}`,
  step_order: order,
  step_type: "ACTION",
  duration_ms: null,
  function_id: fn.id,
  function: fn,
});

const stopStep = (order: number): StudioSequenceStep => ({
  id: `stop-${order}`,
  step_order: order,
  step_type: "STOP",
  duration_ms: null,
  function_id: null,
  function: null,
});

const seqFnWithSteps = (
  id: string,
  steps: StudioSequenceStep[]
): StudioSceneFunction => ({
  ...baseFn(id),
  function_type: "SEQUENCE",
  sequence: `${id}-seq`,
  scene_sequence: { id: `${id}-seq`, name: null, steps },
});

const condition = (
  evalOrder: number,
  varName: string,
  comparison: StudioBranchCondition["comparison"],
  literal: boolean | number | string,
  armFns: StudioSceneFunction[],
  varType: StudioBranchCondition["variable_type"] = "NUMBER",
): StudioBranchCondition => ({
  id: `cond-${evalOrder}`,
  eval_order: evalOrder,
  variable_id: `${varName}-var`,
  variable_name: varName,
  variable_type: varType,
  comparison,
  compare_literal: literal,
  compare_variable_id: null,
  compare_variable_name: null,
  compare_variable_type: null,
  sequence: seqOf(`arm-${evalOrder}`, armFns),
});

const branchFn = (
  id: string,
  conditions: StudioBranchCondition[],
  noMatch: StudioSequence | null,
): StudioSceneFunction => ({
  ...baseFn(id),
  function_type: "BRANCH",
  branch: `${id}-br`,
  scene_branch: { id: `${id}-br`, conditions, no_match_sequence: noMatch },
});

describe("multi-arm branch + Run Sequence walker", () => {
  let store: StudioVariableStore;
  let scheduler: SequenceScheduler;
  let ctx: SequenceRuntimeContext;

  const run = (fn: StudioSceneFunction) =>
    executeFunctionWithRelations(fn, undefined, [], undefined, 0, undefined, ctx);

  beforeEach(() => {
    store = new StudioVariableStore();
    store.seed([
      { id: "score-var", name: "score", type: "NUMBER", initial_value: 7 },
      { id: "result-var", name: "result", type: "NUMBER", initial_value: 0 },
      { id: "label-var", name: "label", type: "STRING", initial_value: "x" },
    ]);
    scheduler = new SequenceScheduler();
    ctx = { scheduler, variableStore: store };
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    scheduler.dispose();
    jest.restoreAllMocks();
  });

  test("first matching condition wins; later true conditions do not run", () => {
    run(
      branchFn(
        "b1",
        [
          condition(0, "score", "EQUALS", 5, [setVarFn("a0", "result", "1")]),
          condition(1, "score", "EQUALS", 7, [setVarFn("a1", "result", "2")]),
          condition(2, "score", "GREATER_THAN", 0, [setVarFn("a2", "result", "3")]),
        ],
        null,
      ),
    );
    expect(store.get("result")).toBe(2);
  });

  test("no-match arm runs when no condition matches", () => {
    run(
      branchFn(
        "b2",
        [
          condition(0, "score", "EQUALS", 1, [setVarFn("a0", "result", "1")]),
          condition(1, "score", "EQUALS", 2, [setVarFn("a1", "result", "2")]),
        ],
        seqOf("nm", [setVarFn("nm0", "result", "99")]),
      ),
    );
    expect(store.get("result")).toBe(99);
  });

  test("a condition that fails to evaluate falls through to the next", () => {
    run(
      branchFn(
        "b3",
        [
          // Ordering comparison on a STRING variable fails to evaluate.
          condition(0, "label", "GREATER_THAN", 5, [setVarFn("a0", "result", "1")], "STRING"),
          condition(1, "score", "EQUALS", 7, [setVarFn("a1", "result", "2")]),
        ],
        null,
      ),
    );
    expect(store.get("result")).toBe(2);
    expect(console.warn).toHaveBeenCalled();
  });

  test("empty conditions run the no-match arm", () => {
    run(branchFn("b4", [], seqOf("nm", [setVarFn("nm0", "result", "42")])));
    expect(store.get("result")).toBe(42);
  });

  test("no match and no no-match arm leaves variables untouched", () => {
    run(
      branchFn(
        "b5",
        [condition(0, "score", "EQUALS", 1, [setVarFn("a0", "result", "1")])],
        null,
      ),
    );
    expect(store.get("result")).toBe(0);
  });

  test("NAVIGATION inside an arm ends the outer sequence", () => {
    const arm = [setVarFn("armRan", "result", "5"), navFn("nav1")];
    run(
      seqFn("S", [
        branchFn("b", [condition(0, "score", "EQUALS", 7, arm)], null),
        setVarFn("after", "after", "1"),
      ]),
    );
    expect(store.get("result")).toBe(5); // arm ran up to NAVIGATION
    expect(store.get("after")).toBeUndefined(); // step after the branch never ran
  });

  test("Run Sequence runs the referenced sequence inline, then the outer continues", () => {
    const ref = seqFn("ref", [setVarFn("inner", "inner", "1")]);
    run(seqFn("S2", [ref, setVarFn("after", "after", "2")]));
    expect(store.get("inner")).toBe(1);
    expect(store.get("after")).toBe(2);
  });

  test("a self-referencing Run Sequence terminates via the depth guard", () => {
    const selfRef = seqFn("loop", []);
    selfRef.scene_sequence!.steps = [
      {
        id: "loop-step",
        step_order: 0,
        step_type: "ACTION",
        duration_ms: null,
        function_id: "loop",
        function: selfRef,
      },
    ];
    expect(() => run(selfRef)).not.toThrow();
    expect(console.warn).toHaveBeenCalled();
  });

  test("STOP halts the sequence; later steps do not run", () => {
    run(
      seqFnWithSteps("S6", [
        actionStep(0, setVarFn("before", "result", "5")),
        stopStep(1),
        actionStep(2, setVarFn("after", "after", "9")),
      ]),
    );
    expect(store.get("result")).toBe(5);
    expect(store.get("after")).toBeUndefined();
  });

  test("STOP inside an arm halts the whole sequence, not just the arm", () => {
    const cond = condition(0, "score", "EQUALS", 7, [
      setVarFn("armRan", "result", "5"),
    ]);
    cond.sequence.steps.push(stopStep(1));
    run(
      seqFnWithSteps("S7", [
        actionStep(0, branchFn("b6", [cond], null)),
        actionStep(1, setVarFn("after", "after", "9")),
      ]),
    );
    expect(store.get("result")).toBe(5); // arm ran up to STOP
    expect(store.get("after")).toBeUndefined(); // step after the branch never ran
  });
});
