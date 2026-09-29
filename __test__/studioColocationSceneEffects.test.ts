import { StudioAnimationSlots } from "../components/Studio/domain/animationSlots";
import {
  type StudioSoundCommand,
  StudioSoundManager,
} from "../components/Studio/domain/soundManager";
import type { StudioEffectOrigin } from "../components/Studio/domain/utils";
import type { StudioAnimation } from "../components/Studio/types";

function anim(
  key: string,
  over: Partial<StudioAnimation> = {}
): StudioAnimation {
  return {
    id: `anim-${key}`,
    scene_id: "scene-1",
    target_asset_id: "crate",
    animation_key: key,
    properties: {},
    duration_ms: 500,
    delay_ms: 0,
    easing: null,
    loop: false,
    interruptible: false,
    on_start_function: null,
    on_finish_function: null,
    ...over,
  };
}

describe("StudioAnimationSlots", () => {
  it("runs a local play's on_start once, however often the runtime reports a start, and its on_finish", () => {
    const slots = new StudioAnimationSlots();
    expect(slots.request(anim("spin"), true, "local")).toBe("start");
    expect(slots.runsOnStart("crate")).toBe(true);
    expect(slots.runsOnStart("crate")).toBe(false);
    expect(slots.finish("crate")).toBe(true);
  });

  it("runs neither for a play another device started", () => {
    const slots = new StudioAnimationSlots();
    slots.request(anim("spin"), true, "remote");
    expect(slots.runsOnStart("crate")).toBe(false);
    expect(slots.finish("crate")).toBe(false);
    // The next local play on the same asset is this device's again.
    slots.request(anim("spin"), true, "local");
    expect(slots.runsOnStart("crate")).toBe(true);
    expect(slots.finish("crate")).toBe(true);
  });

  it("queues behind a running animation that may not be cut short, keeping each play's origin", () => {
    const slots = new StudioAnimationSlots();
    slots.request(anim("spin"), true, "local");
    expect(slots.request(anim("hop"), true, "remote")).toBe("queued");
    expect(slots.request(anim("hop"), true, "remote")).toBe("queued");
    expect(slots.request(anim("hop"), true, "local")).toBe("queued");
    slots.finish("crate");
    expect(slots.next("crate")).toEqual({ key: "hop", origin: "remote" });
    expect(slots.next("crate")).toEqual({ key: "hop", origin: "local" });
    expect(slots.next("crate")).toBeUndefined();
  });

  it("runs both for a device-only play, and reports its origin", () => {
    const slots = new StudioAnimationSlots();
    slots.request(anim("spin"), true, "device");
    expect(slots.runsOnStart("crate")).toBe(true);
    expect(slots.finish("crate")).toBe(true);
    expect(slots.origin("crate")).toBe("device");
    slots.request(anim("spin"), true, "local");
    expect(slots.origin("crate")).toBe("local");
  });

  it("lets a loop or an interruptible animation be replaced at once", () => {
    const looping = new StudioAnimationSlots();
    looping.request(anim("idle", { loop: true }), true, "local");
    expect(looping.request(anim("wave"), true, "remote")).toBe("interrupt");
    expect(looping.runsOnStart("crate")).toBe(false);
    const interruptible = new StudioAnimationSlots();
    interruptible.request(anim("bow", { interruptible: true }), true, "local");
    expect(interruptible.request(anim("jump"), true, "local")).toBe(
      "interrupt"
    );
  });

  it("does not queue behind an asset that has not loaded, since that play never runs", () => {
    const slots = new StudioAnimationSlots();
    slots.request(anim("spin"), false, "local");
    expect(slots.request(anim("hop"), true, "local")).toBe("start");
  });

  it("forgets everything on reset", () => {
    const slots = new StudioAnimationSlots();
    slots.request(anim("spin"), true, "remote");
    slots.request(anim("hop"), true, "local");
    slots.reset();
    expect(slots.next("crate")).toBeUndefined();
    expect(slots.request(anim("hop"), true, "local")).toBe("start");
    expect(slots.runsOnStart("crate")).toBe(true);
  });
});

describe("StudioSoundManager commands", () => {
  function manager() {
    const sounds = new StudioSoundManager();
    const commands: Array<[StudioSoundCommand, StudioEffectOrigin]> = [];
    sounds.subscribeCommands((c, o) => commands.push([c, o]));
    return { sounds, commands };
  }

  const clip = {
    audioAssetId: "door-clip",
    url: "https://cdn.example/door.mp3",
    volume: 0.5,
    loop: false,
    stopOthers: false,
  };

  it("reports each PLAY and STOP with its origin", () => {
    const { sounds, commands } = manager();
    sounds.play(clip);
    sounds.play({ ...clip, position: [0, 1, 0] }, undefined, "remote");
    sounds.stop(null, "remote");
    sounds.stop("door-clip");
    sounds.play(clip, undefined, "device");
    sounds.stop(null, "device");
    expect(commands).toEqual([
      [{ action: "play", ...clip }, "local"],
      [{ action: "play", ...clip, position: [0, 1, 0] }, "remote"],
      [{ action: "stop", audioAssetId: null }, "remote"],
      [{ action: "stop", audioAssetId: "door-clip" }, "local"],
      [{ action: "play", ...clip }, "device"],
      [{ action: "stop", audioAssetId: null }, "device"],
    ]);
  });

  it("does not report a clip ending or a reset", () => {
    const { sounds, commands } = manager();
    const playId = sounds.play(clip);
    commands.length = 0;
    sounds.remove(playId);
    sounds.reset();
    expect(commands).toEqual([]);
  });
});
