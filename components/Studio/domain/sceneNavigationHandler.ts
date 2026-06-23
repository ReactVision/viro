import { Alert, AppState } from "react-native";
import { isQuest } from "../../Utilities/ViroPlatform";
import {
  StudioAnimation,
  StudioApiRequestExecutor,
  StudioApiRequestOutcome,
  StudioSceneFunction,
  StudioSceneResponse,
  StudioSequenceStep,
} from "../types";
import { VRTStudioModule } from "../VRTStudioModule";
import { applyBindings, interpolateDisplayTemplate } from "./apiRequestHelpers";
import {
  evaluate,
  evaluateBranchCondition,
  parseExpression,
  valueMatchesType,
} from "./expressionEvaluator";
import { StudioVariableStore } from "./variableStore";
import { StudioVisibilityStore } from "./visibilityStore";

type SceneNavigator = any; // ViroARSceneNavigator navigator object passed to AR scenes

const ANIMATION_CHAIN_MAX_DEPTH = 10;
// The proxy enforces the authored timeout server-side; the client backstop
// only covers an unreachable/unresponsive proxy.
const API_REQUEST_CLIENT_GRACE_MS = 5000;

/**
 * Non-blocking, cancellable timer pool driving Sequence WAIT steps.
 *
 * One scheduler is owned per scene (see StudioARScene). cancelAll() must run on
 * scene unmount and before navigating away so a pending WAIT never fires into a
 * torn-down or replaced scene.
 *
 * Backgrounding is PAUSE-AND-RESUME: a WAIT freezes while the app is backgrounded
 * and resumes its remaining time on foreground. On mobile this falls out of the
 * suspended JS thread for free; the AppState handling below covers surfaces that
 * keep the JS thread alive in background (e.g. headsets).
 */
type ScheduledTimer = {
  callback: () => void;
  remainingMs: number;
  startedAt: number;
  handle: ReturnType<typeof setTimeout> | null;
};

export class SequenceScheduler {
  private timers = new Set<ScheduledTimer>();
  private appStateSub: { remove: () => void } | null = null;
  private backgrounded = false;
  // Sequence ids currently mid-run. A re-trigger of an in-flight sequence is
  // ignored (no stacked/overlapping runs); single actions are unaffected.
  private activeSequences = new Set<string>();
  // Bumped by cancelAll(). Async work (API requests) captures the value when
  // it starts and drops its continuation if it changed — a late response can
  // never fire into a torn-down or replaced scene.
  private generationCounter = 0;

  get generation(): number {
    return this.generationCounter;
  }

  constructor() {
    this.appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") this.resumeAll();
      else this.pauseAll();
    });
  }

  // Returns false if the sequence is already running (caller should skip).
  beginSequence(id: string): boolean {
    if (this.activeSequences.has(id)) return false;
    this.activeSequences.add(id);
    return true;
  }

  endSequence(id: string): void {
    this.activeSequences.delete(id);
  }

  schedule(callback: () => void, ms: number): void {
    const timer: ScheduledTimer = {
      callback,
      remainingMs: Math.max(0, ms),
      startedAt: Date.now(),
      handle: null,
    };
    this.timers.add(timer);
    if (!this.backgrounded) this.arm(timer);
  }

  private arm(timer: ScheduledTimer): void {
    timer.startedAt = Date.now();
    timer.handle = setTimeout(() => {
      this.timers.delete(timer);
      timer.callback();
    }, timer.remainingMs);
  }

  private pauseAll(): void {
    if (this.backgrounded) return;
    this.backgrounded = true;
    const now = Date.now();
    for (const timer of this.timers) {
      if (timer.handle === null) continue;
      clearTimeout(timer.handle);
      timer.handle = null;
      timer.remainingMs = Math.max(
        0,
        timer.remainingMs - (now - timer.startedAt)
      );
    }
  }

  private resumeAll(): void {
    if (!this.backgrounded) return;
    this.backgrounded = false;
    for (const timer of this.timers) this.arm(timer);
  }

  cancelAll(): void {
    for (const timer of this.timers) {
      if (timer.handle !== null) clearTimeout(timer.handle);
    }
    this.timers.clear();
    this.activeSequences.clear();
    this.generationCounter++;
  }

  dispose(): void {
    this.cancelAll();
    this.appStateSub?.remove();
    this.appStateSub = null;
  }
}

/**
 * Runtime context threaded through executeFunctionWithRelations: the Sequence
 * scheduler plus the per-session variable store and API-request transport
 * (optional so dispatch sites without them keep working).
 */
export type SequenceRuntimeContext = {
  scheduler: SequenceScheduler;
  variableStore?: StudioVariableStore;
  apiRequestExecutor?: StudioApiRequestExecutor;
  visibilityStore?: StudioVisibilityStore;
};

/**
 * Resolves a scene function by ID from a flat list.
 */
function resolveById(
  id: string,
  fns: StudioSceneFunction[]
): StudioSceneFunction | undefined {
  return fns.find((f) => f.id === id);
}

/** Everything the step walker threads through; depth is the owning list's chain depth. */
type StepRunnerDeps = {
  sceneNavigator: SceneNavigator | undefined;
  animations: StudioAnimation[];
  onAnimationTrigger?: (targetAssetId: string, animationKey: string) => void;
  onSceneChange?: (sceneId: string, sceneName: string) => void;
  runtimeCtx: SequenceRuntimeContext;
  depth: number;
};

/**
 * Walks an ordered step list with two continuations: onDone when the list
 * completes, onAbort on early termination (NAVIGATION leaves the scene, STOP
 * halts in place; the top caller releases its beginSequence guard either way,
 * so a failed async navigation can't leave a sequence permanently blocked).
 */
function runSteps(
  steps: StudioSequenceStep[],
  deps: StepRunnerDeps,
  onDone: () => void,
  onAbort: () => void
): void {
  const ordered = [...steps].sort((a, b) => a.step_order - b.step_order);
  const runStep = (i: number): void => {
    if (i >= ordered.length) {
      onDone();
      return;
    }
    const step = ordered[i];
    if (step.step_type === "WAIT") {
      // Non-blocking: the rest of the list continues after the timer.
      deps.runtimeCtx.scheduler.schedule(
        () => runStep(i + 1),
        step.duration_ms ?? 0
      );
      return;
    }
    if (step.step_type === "STOP") {
      // Explicit terminal: halt the whole run. onAbort is threaded unchanged
      // through every nested arm (branch/api/run-sequence), so it skips the
      // outer continuations straight to the top beginSequence guard release —
      // a STOP inside an arm ends the entire sequence, not just that arm.
      onAbort();
      return;
    }
    // ACTION: dispatch the action, then advance.
    if (step.function) {
      // BRANCH needs the continuation: the outer list resumes only after the
      // chosen arm completes (arm WAITs delay later outer steps).
      if (step.function.function_type === "BRANCH") {
        runBranch(step.function, deps, () => runStep(i + 1), onAbort);
        return;
      }
      // API_REQUEST blocks the outer list until the response (or timeout)
      // resolves and the chosen outcome arm completes.
      if (step.function.function_type === "API_REQUEST") {
        runApiRequest(step.function, deps, () => runStep(i + 1), onAbort);
        return;
      }
      // RUN_SEQUENCE: a step referencing a named SEQUENCE function runs that
      // sequence's steps inline (not begin-guarded, like an arm); the outer
      // list resumes only after it completes. The depth guard bounds chains.
      if (step.function.function_type === "SEQUENCE") {
        runReferencedSequence(
          step.function,
          deps,
          () => runStep(i + 1),
          onAbort
        );
        return;
      }
      executeFunctionWithRelations(
        step.function,
        deps.sceneNavigator,
        deps.animations,
        deps.onAnimationTrigger,
        deps.depth + 1,
        deps.onSceneChange,
        deps.runtimeCtx
      );
      // A step list is scoped to one scene. NAVIGATION leaves it, so the walk
      // ends here; remaining steps belong to the scene we just left.
      // Author follow-on steps as the target scene's on_load sequence.
      if (step.function.function_type === "NAVIGATION") {
        onAbort();
        return;
      }
      // ANIMATION: hold the walk for the animation's run time so later steps
      // (including WAIT) begin when it finishes, not when it starts.
      if (step.function.function_type === "ANIMATION") {
        const anim = step.function.scene_animation;
        const runMs = (anim?.delay_ms ?? 0) + (anim?.duration_ms ?? 0);
        deps.runtimeCtx.scheduler.schedule(() => runStep(i + 1), runMs);
        return;
      }
    }
    runStep(i + 1);
  };
  runStep(0);
}

/**
 * Evaluates a BRANCH's conditions in eval order (first match wins) and runs the
 * matched arm, or the no-match arm if none match, like a nested sequence.
 * Failure policy: a condition that fails to evaluate warns and is treated as
 * not matched (fall through to the next condition); never throws.
 */
function runBranch(
  fn: StudioSceneFunction,
  deps: StepRunnerDeps,
  onDone: () => void,
  onAbort: () => void
): void {
  const branch = fn.scene_branch;
  if (!branch) {
    onDone();
    return;
  }
  const branchDepth = deps.depth + 1;
  if (branchDepth > ANIMATION_CHAIN_MAX_DEPTH) {
    console.warn(
      `[Studio] Max chain depth (${ANIMATION_CHAIN_MAX_DEPTH}) exceeded for branch ${branch.id}.`
    );
    onDone();
    return;
  }
  const store = deps.runtimeCtx.variableStore;
  if (!store) {
    console.warn(
      `[Studio] BRANCH function ${fn.id} needs a runtime context (variable store); skipping.`
    );
    onDone();
    return;
  }
  const conditions = [...branch.conditions].sort(
    (a, b) => a.eval_order - b.eval_order
  );
  for (const condition of conditions) {
    const result = evaluateBranchCondition(
      {
        comparison: condition.comparison,
        variable_name: condition.variable_name,
        compare_literal: condition.compare_literal,
        compare_variable_name: condition.compare_variable_name,
      },
      (name) => store.get(name)
    );
    if (!result.ok) {
      console.warn(
        `[Studio] BRANCH ${branch.id} condition ${condition.eval_order}: ${result.error}; treating as not matched.`
      );
      continue;
    }
    if (result.value) {
      runSteps(
        condition.sequence.steps,
        { ...deps, depth: branchDepth },
        onDone,
        onAbort
      );
      return;
    }
  }
  // No condition matched: run the no-match arm if present, else continue.
  const arm = branch.no_match_sequence;
  if (!arm) {
    onDone();
    return;
  }
  runSteps(arm.steps, { ...deps, depth: branchDepth }, onDone, onAbort);
}

/**
 * Runs a named SEQUENCE function's steps inline as a Run Sequence step. Unlike
 * a trigger-dispatched sequence it is NOT begin-guarded (it composes like a
 * branch arm); the depth guard bounds reference chains the editor's cycle
 * filter and the resolve RPC also defend against.
 */
function runReferencedSequence(
  fn: StudioSceneFunction,
  deps: StepRunnerDeps,
  onDone: () => void,
  onAbort: () => void
): void {
  const seq = fn.scene_sequence;
  if (!seq) {
    onDone();
    return;
  }
  const seqDepth = deps.depth + 1;
  if (seqDepth > ANIMATION_CHAIN_MAX_DEPTH) {
    console.warn(
      `[Studio] Max chain depth (${ANIMATION_CHAIN_MAX_DEPTH}) exceeded for sequence ${seq.id}.`
    );
    onDone();
    return;
  }
  runSteps(seq.steps, { ...deps, depth: seqDepth }, onDone, onAbort);
}

/**
 * Executes an API_REQUEST through the injected executor and runs the matching
 * outcome arm like a nested sequence. The proxy enforces the real timeout; a
 * scheduler backstop covers an unreachable proxy. Failure policy mirrors
 * SET_VARIABLE/BRANCH: warn + degrade, never throw. A scheduler generation
 * captured at start drops the continuation if the scene is torn down or
 * replaced while the request is in flight.
 */
function runApiRequest(
  fn: StudioSceneFunction,
  deps: StepRunnerDeps,
  onDone: () => void,
  onAbort: () => void
): void {
  const apiRequest = fn.scene_api_request;
  if (!apiRequest) {
    onDone();
    return;
  }
  const chainDepth = deps.depth + 1;
  if (chainDepth > ANIMATION_CHAIN_MAX_DEPTH) {
    console.warn(
      `[Studio] Max chain depth (${ANIMATION_CHAIN_MAX_DEPTH}) exceeded for API request ${apiRequest.id}.`
    );
    onDone();
    return;
  }
  const executor = deps.runtimeCtx.apiRequestExecutor;
  if (!executor) {
    console.warn(
      `[Studio] API_REQUEST function ${fn.id} needs a runtime context (executor); skipping.`
    );
    onDone();
    return;
  }
  const scheduler = deps.runtimeCtx.scheduler;
  const store = deps.runtimeCtx.variableStore;
  const generation = scheduler.generation;
  let settled = false;

  const proceed = (outcome: StudioApiRequestOutcome): void => {
    if (settled || scheduler.generation !== generation) return;
    settled = true;
    if (store) {
      const { writes, warnings } = applyBindings(
        apiRequest.bindings ?? [],
        outcome
      );
      for (const warning of warnings) {
        console.warn(`[Studio] API_REQUEST ${apiRequest.id}: ${warning}`);
      }
      for (const write of writes) {
        store.set(write.name, write.value);
      }
    } else if ((apiRequest.bindings ?? []).length > 0) {
      console.warn(
        `[Studio] API_REQUEST ${apiRequest.id}: no variable store; bindings skipped.`
      );
    }
    const arm = outcome.ok
      ? apiRequest.success_sequence
      : apiRequest.failure_sequence;
    if (!arm) {
      onDone();
      return;
    }
    runSteps(arm.steps, { ...deps, depth: chainDepth }, onDone, onAbort);
  };

  scheduler.schedule(() => {
    proceed({
      ok: false,
      status: null,
      error_code: "TIMEOUT",
      error_message: "Request timed out",
    });
  }, apiRequest.timeout_ms + API_REQUEST_CLIENT_GRACE_MS);

  const variables = store ? store.snapshot() : {};
  executor(fn.id, variables)
    .then((outcome) => proceed(outcome))
    .catch((error: unknown) => {
      proceed({
        ok: false,
        status: null,
        error_code: "NETWORK_ERROR",
        error_message:
          error instanceof Error ? error.message : "Request failed",
      });
    });
}

/**
 * Looks up target_asset_id for an ANIMATION-type scene function.
 * The inline scene_animation only has the animation UUID — we resolve it
 * from the top-level animations array.
 */
function resolveAnimationTargetAssetId(
  animationId: string,
  animations: StudioAnimation[]
): string | undefined {
  return animations.find((a) => a.id === animationId)?.target_asset_id;
}

/**
 * Single dispatcher for all scene function types.
 * Used by onClick, onCollision, and on_load_function triggers.
 */
export function executeFunctionWithRelations(
  fn: StudioSceneFunction,
  sceneNavigator: SceneNavigator | undefined,
  animations: StudioAnimation[],
  onAnimationTrigger?: (targetAssetId: string, animationKey: string) => void,
  depth = 0,
  onSceneChange?: (sceneId: string, sceneName: string) => void,
  runtimeCtx?: SequenceRuntimeContext
): void {
  if (depth > ANIMATION_CHAIN_MAX_DEPTH) {
    console.warn(
      `[Studio] Max chain depth (${ANIMATION_CHAIN_MAX_DEPTH}) exceeded for function ${fn.id}.`
    );
    return;
  }

  if (fn.function_type === "SEQUENCE") {
    const seq = fn.scene_sequence;
    if (!seq) return;
    if (!runtimeCtx) {
      console.warn(
        `[Studio] SEQUENCE function ${fn.id} needs a runtime context (scheduler); skipping.`
      );
      return;
    }
    // Ignore a re-trigger while this sequence is still running (no stacking).
    if (!runtimeCtx.scheduler.beginSequence(seq.id)) return;
    const finish = () => runtimeCtx.scheduler.endSequence(seq.id);
    runSteps(
      seq.steps,
      {
        sceneNavigator,
        animations,
        onAnimationTrigger,
        onSceneChange,
        runtimeCtx,
        depth,
      },
      finish,
      finish
    );
    return;
  }

  if (fn.function_type === "NAVIGATION") {
    const nav = fn.scene_navigation;
    if (!nav?.navigate_to || !sceneNavigator) return;
    void navigateToScene(
      sceneNavigator,
      nav.navigate_to,
      animations,
      onSceneChange,
      runtimeCtx?.variableStore
    );
  } else if (fn.function_type === "ALERT") {
    const alert = fn.scene_alert;
    if (!alert) return;
    // Fail-soft {{variable}} interpolation: unresolved names stay literal so a
    // stale reference never blanks or suppresses the alert.
    const store = runtimeCtx?.variableStore;
    const fill = (s: string | null): string =>
      s ? interpolateDisplayTemplate(s, (name) => store?.get(name)) : "";
    const title = fill(alert.alert_title);
    const message = fill(alert.alert_message);
    if (isQuest) {
      // Alert.alert shows a 2D panel dialog — invisible in the VR compositor.
      // Log it so it's not silently swallowed; in-scene VR alert UI is a TODO.
      console.warn(
        `[Studio] Alert (Quest — not shown in VR): "${title}" — ${message}`
      );
      return;
    }
    Alert.alert(title || "Alert", message, [{ text: "OK", style: "default" }]);
  } else if (fn.function_type === "ANIMATION") {
    const anim = fn.scene_animation;
    if (!anim || !onAnimationTrigger) return;

    const animLookupId = fn.animation ?? anim.id;
    const targetAssetId = resolveAnimationTargetAssetId(
      animLookupId,
      animations
    );
    if (!targetAssetId) {
      console.warn(
        `[Studio] ANIMATION function ${fn.id}: could not resolve target_asset_id for animation ${anim.id}`
      );
      return;
    }
    onAnimationTrigger(targetAssetId, anim.animation_key);
  } else if (fn.function_type === "SET_VARIABLE") {
    // Failure policy: warn + skip the write, never throw — the sequence continues.
    const sv = fn.scene_set_variable;
    const store = runtimeCtx?.variableStore;
    if (!sv) return;
    if (!store) {
      console.warn(
        `[Studio] SET_VARIABLE function ${fn.id} needs a runtime context (variable store); skipping.`
      );
      return;
    }
    const parsed = parseExpression(sv.expression);
    if (!parsed.ok) {
      console.warn(
        `[Studio] SET_VARIABLE "${sv.name}": ${parsed.error}; skipping.`
      );
      return;
    }
    const result = evaluate(parsed.ast, (name) => store.get(name));
    if (!result.ok) {
      console.warn(
        `[Studio] SET_VARIABLE "${sv.name}": ${result.error}; skipping.`
      );
      return;
    }
    if (!valueMatchesType(result.value, sv.type)) {
      console.warn(
        `[Studio] SET_VARIABLE "${sv.name}": result is a ${typeof result.value}, expected ${sv.type}; skipping.`
      );
      return;
    }
    store.set(sv.name, result.value);
  } else if (fn.function_type === "BRANCH") {
    // Branch is authored in-sequence (runSteps dispatches it there with the
    // outer continuation); this path covers a trigger wired directly to a
    // BRANCH function. Guard like a sequence so arm WAITs can't stack runs.
    const branch = fn.scene_branch;
    if (!branch) return;
    if (!runtimeCtx) {
      console.warn(
        `[Studio] BRANCH function ${fn.id} needs a runtime context (scheduler); skipping.`
      );
      return;
    }
    if (!runtimeCtx.scheduler.beginSequence(branch.id)) return;
    const finish = () => runtimeCtx.scheduler.endSequence(branch.id);
    runBranch(
      fn,
      {
        sceneNavigator,
        animations,
        onAnimationTrigger,
        onSceneChange,
        runtimeCtx,
        depth,
      },
      finish,
      finish
    );
  } else if (fn.function_type === "API_REQUEST") {
    // Authored in-sequence (runSteps dispatches it there with the outer
    // continuation); this path covers a trigger wired directly to an
    // API_REQUEST function. Guard like a sequence so a re-trigger can't
    // stack runs while a request (or an arm WAIT) is in flight.
    const apiRequest = fn.scene_api_request;
    if (!apiRequest) return;
    if (!runtimeCtx) {
      console.warn(
        `[Studio] API_REQUEST function ${fn.id} needs a runtime context (scheduler); skipping.`
      );
      return;
    }
    if (!runtimeCtx.scheduler.beginSequence(apiRequest.id)) return;
    const finish = () => runtimeCtx.scheduler.endSequence(apiRequest.id);
    runApiRequest(
      fn,
      {
        sceneNavigator,
        animations,
        onAnimationTrigger,
        onSceneChange,
        runtimeCtx,
        depth,
      },
      finish,
      finish
    );
  } else if (fn.function_type === "SET_VISIBILITY") {
    // Instant show / hide / toggle. Fire-and-forget: as a sequence step it
    // dispatches and the walk advances immediately (no duration to wait on).
    // TOGGLE reads the live runtime value from the store, never the author
    // default. Failure policy: warn + skip, never throw.
    const sv = fn.scene_set_visibility;
    const store = runtimeCtx?.visibilityStore;
    if (!sv) return;
    if (!store) {
      console.warn(
        `[Studio] SET_VISIBILITY function ${fn.id} needs a runtime context (visibility store); skipping.`
      );
      return;
    }
    store.apply(sv.target_asset_id, sv.state);
  }
}

/**
 * Executes the scene's on_load_function if set.
 */
export function executeOnLoadFunction(
  functionId: string,
  functions: StudioSceneFunction[],
  sceneNavigator: SceneNavigator | undefined,
  animations: StudioAnimation[],
  onAnimationTrigger?: (targetAssetId: string, animationKey: string) => void,
  onSceneChange?: (sceneId: string, sceneName: string) => void,
  runtimeCtx?: SequenceRuntimeContext
): void {
  const fn = resolveById(functionId, functions);
  if (!fn) {
    console.warn(`[Studio] on_load_function ${functionId} not found.`);
    return;
  }
  executeFunctionWithRelations(
    fn,
    sceneNavigator,
    animations,
    onAnimationTrigger,
    0,
    onSceneChange,
    runtimeCtx
  );
}

/**
 * Navigates to a new AR scene by fetching its data via rvGetScene and
 * pushing it onto the ViroARSceneNavigator stack.
 *
 * The sceneNavigator object exposes rvGetScene as a method — no separate
 * API client needed here.
 */
async function navigateToScene(
  sceneNavigator: SceneNavigator,
  targetSceneId: string,
  currentAnimations: StudioAnimation[],
  onSceneChange?: (sceneId: string, sceneName: string) => void,
  variableStore?: StudioVariableStore
): Promise<void> {
  if (!sceneNavigator) {
    console.error("[Studio] SceneNavigator not available for navigation");
    Alert.alert("Navigation Error", "Unable to navigate to scene");
    return;
  }

  console.log(`[Studio] Navigating to scene: ${targetSceneId}`);

  try {
    const result = await VRTStudioModule.rvGetScene(targetSceneId);
    if (!result?.success) {
      throw new Error(result?.error ?? "rvGetScene failed");
    }

    const sceneData: StudioSceneResponse = JSON.parse(result.data!);

    // Lazy import to avoid circular dependency
    const { StudioARScene } = require("../StudioARScene");

    sceneNavigator.push({
      scene: StudioARScene,
      passProps: {
        sceneData,
        onSceneChange,
        // The session store rides along on every push so values survive scene
        // transitions for the navigator's whole lifetime.
        variableStore,
      },
    });

    onSceneChange?.(targetSceneId, sceneData.scene.name ?? targetSceneId);
    console.log(`[Studio] Navigated to scene: ${sceneData.scene.name}`);
  } catch (error) {
    console.error("[Studio] Error navigating to scene:", error);
    Alert.alert("Navigation Error", "Failed to load scene");
  }
}
