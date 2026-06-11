import { Alert, AppState } from "react-native";
import { isQuest } from "../../Utilities/ViroPlatform";
import {
  StudioAnimation,
  StudioSceneFunction,
  StudioSceneResponse,
  StudioSequenceStep,
} from "../types";
import { VRTStudioModule } from "../VRTStudioModule";
import {
  evaluate,
  evaluateBranchCondition,
  parseExpression,
  valueMatchesType,
} from "./expressionEvaluator";
import { StudioVariableStore } from "./variableStore";

type SceneNavigator = any; // ViroARSceneNavigator navigator object passed to AR scenes

const ANIMATION_CHAIN_MAX_DEPTH = 10;

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
      timer.remainingMs = Math.max(0, timer.remainingMs - (now - timer.startedAt));
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
  }

  dispose(): void {
    this.cancelAll();
    this.appStateSub?.remove();
    this.appStateSub = null;
  }
}

/**
 * Runtime context threaded through executeFunctionWithRelations: the Sequence
 * scheduler plus the per-session variable store (optional so dispatch sites
 * without variables keep working).
 */
export type SequenceRuntimeContext = {
  scheduler: SequenceScheduler;
  variableStore?: StudioVariableStore;
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
 * completes, onAbort on early termination (NAVIGATION leaves the scene; the
 * top caller releases its beginSequence guard either way, so a failed async
 * navigation can't leave a sequence permanently blocked).
 */
function runSteps(
  steps: StudioSequenceStep[],
  deps: StepRunnerDeps,
  onDone: () => void,
  onAbort: () => void,
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
      deps.runtimeCtx.scheduler.schedule(() => runStep(i + 1), step.duration_ms ?? 0);
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
      executeFunctionWithRelations(
        step.function,
        deps.sceneNavigator,
        deps.animations,
        deps.onAnimationTrigger,
        deps.depth + 1,
        deps.onSceneChange,
        deps.runtimeCtx,
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
 * Evaluates a BRANCH condition and runs the chosen arm like a nested sequence.
 * Failure policy: warn + skip both arms + continue the outer list, never throw.
 */
function runBranch(
  fn: StudioSceneFunction,
  deps: StepRunnerDeps,
  onDone: () => void,
  onAbort: () => void,
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
  const result = evaluateBranchCondition(
    {
      comparison: branch.comparison,
      variable_name: branch.variable_name,
      compare_literal: branch.compare_literal,
      compare_variable_name: branch.compare_variable_name,
    },
    (name) => store.get(name),
  );
  if (!result.ok) {
    console.warn(`[Studio] BRANCH ${branch.id}: ${result.error}; skipping both arms.`);
    onDone();
    return;
  }
  const arm = result.value ? branch.then_sequence : branch.else_sequence;
  if (!arm) {
    onDone();
    return;
  }
  runSteps(arm.steps, { ...deps, depth: branchDepth }, onDone, onAbort);
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
  runtimeCtx?: SequenceRuntimeContext,
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
      { sceneNavigator, animations, onAnimationTrigger, onSceneChange, runtimeCtx, depth },
      finish,
      finish,
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
      runtimeCtx?.variableStore,
    );
  } else if (fn.function_type === "ALERT") {
    const alrt = fn.scene_alert;
    if (!alrt) return;
    if (isQuest) {
      // Alert.alert shows a 2D panel dialog — invisible in the VR compositor.
      // Log it so it's not silently swallowed; in-scene VR alert UI is a TODO.
      console.warn(
        `[Studio] Alert (Quest — not shown in VR): "${alrt.alert_title}" — ${alrt.alert_message}`
      );
      return;
    }
    Alert.alert(alrt.alert_title ?? "Alert", alrt.alert_message ?? "", [
      { text: "OK", style: "default" },
    ]);
  } else if (fn.function_type === "ANIMATION") {
    const anim = fn.scene_animation;
    if (!anim || !onAnimationTrigger) return;

    const animLookupId = fn.animation ?? anim.id;
    const targetAssetId = resolveAnimationTargetAssetId(animLookupId, animations);
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
      console.warn(`[Studio] SET_VARIABLE "${sv.name}": ${parsed.error}; skipping.`);
      return;
    }
    const result = evaluate(parsed.ast, (name) => store.get(name));
    if (!result.ok) {
      console.warn(`[Studio] SET_VARIABLE "${sv.name}": ${result.error}; skipping.`);
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
      { sceneNavigator, animations, onAnimationTrigger, onSceneChange, runtimeCtx, depth },
      finish,
      finish,
    );
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
  runtimeCtx?: SequenceRuntimeContext,
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
    runtimeCtx,
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
  variableStore?: StudioVariableStore,
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
