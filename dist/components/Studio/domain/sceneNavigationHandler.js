"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SequenceScheduler = void 0;
exports.executeFunctionWithRelations = executeFunctionWithRelations;
exports.executeOnLoadFunction = executeOnLoadFunction;
const react_native_1 = require("react-native");
const ViroPlatform_1 = require("../../Utilities/ViroPlatform");
const VRTStudioModule_1 = require("../VRTStudioModule");
const expressionEvaluator_1 = require("./expressionEvaluator");
const ANIMATION_CHAIN_MAX_DEPTH = 10;
class SequenceScheduler {
    timers = new Set();
    appStateSub = null;
    backgrounded = false;
    // Sequence ids currently mid-run. A re-trigger of an in-flight sequence is
    // ignored (no stacked/overlapping runs); single actions are unaffected.
    activeSequences = new Set();
    constructor() {
        this.appStateSub = react_native_1.AppState.addEventListener("change", (state) => {
            if (state === "active")
                this.resumeAll();
            else
                this.pauseAll();
        });
    }
    // Returns false if the sequence is already running (caller should skip).
    beginSequence(id) {
        if (this.activeSequences.has(id))
            return false;
        this.activeSequences.add(id);
        return true;
    }
    endSequence(id) {
        this.activeSequences.delete(id);
    }
    schedule(callback, ms) {
        const timer = {
            callback,
            remainingMs: Math.max(0, ms),
            startedAt: Date.now(),
            handle: null,
        };
        this.timers.add(timer);
        if (!this.backgrounded)
            this.arm(timer);
    }
    arm(timer) {
        timer.startedAt = Date.now();
        timer.handle = setTimeout(() => {
            this.timers.delete(timer);
            timer.callback();
        }, timer.remainingMs);
    }
    pauseAll() {
        if (this.backgrounded)
            return;
        this.backgrounded = true;
        const now = Date.now();
        for (const timer of this.timers) {
            if (timer.handle === null)
                continue;
            clearTimeout(timer.handle);
            timer.handle = null;
            timer.remainingMs = Math.max(0, timer.remainingMs - (now - timer.startedAt));
        }
    }
    resumeAll() {
        if (!this.backgrounded)
            return;
        this.backgrounded = false;
        for (const timer of this.timers)
            this.arm(timer);
    }
    cancelAll() {
        for (const timer of this.timers) {
            if (timer.handle !== null)
                clearTimeout(timer.handle);
        }
        this.timers.clear();
        this.activeSequences.clear();
    }
    dispose() {
        this.cancelAll();
        this.appStateSub?.remove();
        this.appStateSub = null;
    }
}
exports.SequenceScheduler = SequenceScheduler;
/**
 * Resolves a scene function by ID from a flat list.
 */
function resolveById(id, fns) {
    return fns.find((f) => f.id === id);
}
/**
 * Walks an ordered step list with two continuations: onDone when the list
 * completes, onAbort on early termination (NAVIGATION leaves the scene; the
 * top caller releases its beginSequence guard either way, so a failed async
 * navigation can't leave a sequence permanently blocked).
 */
function runSteps(steps, deps, onDone, onAbort) {
    const ordered = [...steps].sort((a, b) => a.step_order - b.step_order);
    const runStep = (i) => {
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
            executeFunctionWithRelations(step.function, deps.sceneNavigator, deps.animations, deps.onAnimationTrigger, deps.depth + 1, deps.onSceneChange, deps.runtimeCtx);
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
function runBranch(fn, deps, onDone, onAbort) {
    const branch = fn.scene_branch;
    if (!branch) {
        onDone();
        return;
    }
    const branchDepth = deps.depth + 1;
    if (branchDepth > ANIMATION_CHAIN_MAX_DEPTH) {
        console.warn(`[Studio] Max chain depth (${ANIMATION_CHAIN_MAX_DEPTH}) exceeded for branch ${branch.id}.`);
        onDone();
        return;
    }
    const store = deps.runtimeCtx.variableStore;
    if (!store) {
        console.warn(`[Studio] BRANCH function ${fn.id} needs a runtime context (variable store); skipping.`);
        onDone();
        return;
    }
    const result = (0, expressionEvaluator_1.evaluateBranchCondition)({
        comparison: branch.comparison,
        variable_name: branch.variable_name,
        compare_literal: branch.compare_literal,
        compare_variable_name: branch.compare_variable_name,
    }, (name) => store.get(name));
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
function resolveAnimationTargetAssetId(animationId, animations) {
    return animations.find((a) => a.id === animationId)?.target_asset_id;
}
/**
 * Single dispatcher for all scene function types.
 * Used by onClick, onCollision, and on_load_function triggers.
 */
function executeFunctionWithRelations(fn, sceneNavigator, animations, onAnimationTrigger, depth = 0, onSceneChange, runtimeCtx) {
    if (depth > ANIMATION_CHAIN_MAX_DEPTH) {
        console.warn(`[Studio] Max chain depth (${ANIMATION_CHAIN_MAX_DEPTH}) exceeded for function ${fn.id}.`);
        return;
    }
    if (fn.function_type === "SEQUENCE") {
        const seq = fn.scene_sequence;
        if (!seq)
            return;
        if (!runtimeCtx) {
            console.warn(`[Studio] SEQUENCE function ${fn.id} needs a runtime context (scheduler); skipping.`);
            return;
        }
        // Ignore a re-trigger while this sequence is still running (no stacking).
        if (!runtimeCtx.scheduler.beginSequence(seq.id))
            return;
        const finish = () => runtimeCtx.scheduler.endSequence(seq.id);
        runSteps(seq.steps, { sceneNavigator, animations, onAnimationTrigger, onSceneChange, runtimeCtx, depth }, finish, finish);
        return;
    }
    if (fn.function_type === "NAVIGATION") {
        const nav = fn.scene_navigation;
        if (!nav?.navigate_to || !sceneNavigator)
            return;
        void navigateToScene(sceneNavigator, nav.navigate_to, animations, onSceneChange, runtimeCtx?.variableStore);
    }
    else if (fn.function_type === "ALERT") {
        const alrt = fn.scene_alert;
        if (!alrt)
            return;
        if (ViroPlatform_1.isQuest) {
            // Alert.alert shows a 2D panel dialog — invisible in the VR compositor.
            // Log it so it's not silently swallowed; in-scene VR alert UI is a TODO.
            console.warn(`[Studio] Alert (Quest — not shown in VR): "${alrt.alert_title}" — ${alrt.alert_message}`);
            return;
        }
        react_native_1.Alert.alert(alrt.alert_title ?? "Alert", alrt.alert_message ?? "", [
            { text: "OK", style: "default" },
        ]);
    }
    else if (fn.function_type === "ANIMATION") {
        const anim = fn.scene_animation;
        if (!anim || !onAnimationTrigger)
            return;
        const animLookupId = fn.animation ?? anim.id;
        const targetAssetId = resolveAnimationTargetAssetId(animLookupId, animations);
        if (!targetAssetId) {
            console.warn(`[Studio] ANIMATION function ${fn.id}: could not resolve target_asset_id for animation ${anim.id}`);
            return;
        }
        onAnimationTrigger(targetAssetId, anim.animation_key);
    }
    else if (fn.function_type === "SET_VARIABLE") {
        // Failure policy: warn + skip the write, never throw — the sequence continues.
        const sv = fn.scene_set_variable;
        const store = runtimeCtx?.variableStore;
        if (!sv)
            return;
        if (!store) {
            console.warn(`[Studio] SET_VARIABLE function ${fn.id} needs a runtime context (variable store); skipping.`);
            return;
        }
        const parsed = (0, expressionEvaluator_1.parseExpression)(sv.expression);
        if (!parsed.ok) {
            console.warn(`[Studio] SET_VARIABLE "${sv.name}": ${parsed.error}; skipping.`);
            return;
        }
        const result = (0, expressionEvaluator_1.evaluate)(parsed.ast, (name) => store.get(name));
        if (!result.ok) {
            console.warn(`[Studio] SET_VARIABLE "${sv.name}": ${result.error}; skipping.`);
            return;
        }
        if (!(0, expressionEvaluator_1.valueMatchesType)(result.value, sv.type)) {
            console.warn(`[Studio] SET_VARIABLE "${sv.name}": result is a ${typeof result.value}, expected ${sv.type}; skipping.`);
            return;
        }
        store.set(sv.name, result.value);
    }
    else if (fn.function_type === "BRANCH") {
        // Branch is authored in-sequence (runSteps dispatches it there with the
        // outer continuation); this path covers a trigger wired directly to a
        // BRANCH function. Guard like a sequence so arm WAITs can't stack runs.
        const branch = fn.scene_branch;
        if (!branch)
            return;
        if (!runtimeCtx) {
            console.warn(`[Studio] BRANCH function ${fn.id} needs a runtime context (scheduler); skipping.`);
            return;
        }
        if (!runtimeCtx.scheduler.beginSequence(branch.id))
            return;
        const finish = () => runtimeCtx.scheduler.endSequence(branch.id);
        runBranch(fn, { sceneNavigator, animations, onAnimationTrigger, onSceneChange, runtimeCtx, depth }, finish, finish);
    }
}
/**
 * Executes the scene's on_load_function if set.
 */
function executeOnLoadFunction(functionId, functions, sceneNavigator, animations, onAnimationTrigger, onSceneChange, runtimeCtx) {
    const fn = resolveById(functionId, functions);
    if (!fn) {
        console.warn(`[Studio] on_load_function ${functionId} not found.`);
        return;
    }
    executeFunctionWithRelations(fn, sceneNavigator, animations, onAnimationTrigger, 0, onSceneChange, runtimeCtx);
}
/**
 * Navigates to a new AR scene by fetching its data via rvGetScene and
 * pushing it onto the ViroARSceneNavigator stack.
 *
 * The sceneNavigator object exposes rvGetScene as a method — no separate
 * API client needed here.
 */
async function navigateToScene(sceneNavigator, targetSceneId, currentAnimations, onSceneChange, variableStore) {
    if (!sceneNavigator) {
        console.error("[Studio] SceneNavigator not available for navigation");
        react_native_1.Alert.alert("Navigation Error", "Unable to navigate to scene");
        return;
    }
    console.log(`[Studio] Navigating to scene: ${targetSceneId}`);
    try {
        const result = await VRTStudioModule_1.VRTStudioModule.rvGetScene(targetSceneId);
        if (!result?.success) {
            throw new Error(result?.error ?? "rvGetScene failed");
        }
        const sceneData = JSON.parse(result.data);
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
    }
    catch (error) {
        console.error("[Studio] Error navigating to scene:", error);
        react_native_1.Alert.alert("Navigation Error", "Failed to load scene");
    }
}
