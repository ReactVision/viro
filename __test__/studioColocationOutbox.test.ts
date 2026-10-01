import { StudioReplicationOutbox } from "../components/Studio/colocation/outbox";

jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));

function outbox() {
  const sent: Array<[string, Record<string, unknown> | null]> = [];
  const box = new StudioReplicationOutbox((id, fields) =>
    sent.push([id, fields])
  );
  return { box, sent };
}

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe("StudioReplicationOutbox", () => {
  it("keeps a queued entity's place in line when its value is replaced", () => {
    const { box, sent } = outbox();
    box.write("a", { v: 1 });
    box.write("b", { v: 1 });
    box.write("a", { v: 2 });
    box.write("b", { v: 2 });
    box.write("a", { v: 3 });
    expect(sent).toEqual([
      ["a", { v: 1 }],
      ["b", { v: 1 }],
    ]);
    jest.advanceTimersByTime(33);
    expect(sent.slice(2)).toEqual([
      ["a", { v: 3 }],
      ["b", { v: 2 }],
    ]);
  });

  it("paces a burst across entities below the relay's message limit", () => {
    const { box, sent } = outbox();
    for (let i = 0; i < 60; i++) box.write(`e${i}`, { v: i });
    expect(sent).toHaveLength(30);
    jest.advanceTimersByTime(250);
    // 60 a second after the burst: about 15 more in a quarter second.
    expect(sent.length).toBeGreaterThanOrEqual(44);
    expect(sent.length).toBeLessThanOrEqual(46);
    jest.advanceTimersByTime(1000);
    expect(sent).toHaveLength(60);
    expect(sent.map(([id]) => id)).toEqual(
      Array.from({ length: 60 }, (_, i) => `e${i}`)
    );
  });

  it("never sends more than 60 a second once the burst is spent", () => {
    const { box, sent } = outbox();
    for (let i = 0; i < 30; i++) box.write(`warm${i}`, {});
    for (let t = 0; t < 2000; t += 10) {
      box.write(`e${t}`, {});
      jest.advanceTimersByTime(10);
    }
    expect(sent.length - 30).toBeLessThanOrEqual(121);
  });

  it("paces a delete like a write, and lets a later write replace it", () => {
    const { box, sent } = outbox();
    box.write("a", { v: 1 });
    box.remove("a");
    box.remove("b");
    expect(sent).toEqual([
      ["a", { v: 1 }],
      ["b", null],
    ]);
    expect(box.isQueued("a")).toBe(true);
    box.write("a", { v: 2 });
    jest.advanceTimersByTime(33);
    expect(sent.slice(2)).toEqual([["a", { v: 2 }]]);
  });

  it("drops what it has not sent when cleared", () => {
    const { box, sent } = outbox();
    box.write("a", { v: 1 });
    box.write("a", { v: 2 });
    expect(box.isQueued("a")).toBe(true);
    expect(box.clear()).toEqual(["a"]);
    expect(box.isQueued("a")).toBe(false);
    jest.advanceTimersByTime(100);
    expect(sent).toEqual([["a", { v: 1 }]]);
  });
});
