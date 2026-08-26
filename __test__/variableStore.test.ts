import { StudioVariableStore } from "../components/Studio/domain/variableStore";

describe("StudioVariableStore subscriptions", () => {
  test("set notifies subscribers", () => {
    const store = new StudioVariableStore();
    let calls = 0;
    store.subscribe(() => {
      calls++;
    });
    store.set("score", 1);
    store.set("score", 2);
    expect(calls).toBe(2);
  });

  test("unsubscribe stops notifications", () => {
    const store = new StudioVariableStore();
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls++;
    });
    store.set("score", 1);
    unsubscribe();
    store.set("score", 2);
    expect(calls).toBe(1);
  });

  test("reset notifies subscribers", () => {
    const store = new StudioVariableStore();
    let calls = 0;
    store.subscribe(() => {
      calls++;
    });
    store.reset();
    expect(calls).toBe(1);
  });

  test("setting the same value does not notify", () => {
    const store = new StudioVariableStore();
    let calls = 0;
    store.subscribe(() => {
      calls++;
    });
    store.set("score", 5);
    store.set("score", 5);
    store.set("score", 5);
    expect(calls).toBe(1);
  });

  test("multiple subscribers all fire", () => {
    const store = new StudioVariableStore();
    let a = 0;
    let b = 0;
    store.subscribe(() => {
      a++;
    });
    store.subscribe(() => {
      b++;
    });
    store.set("x", true);
    expect(a).toBe(1);
    expect(b).toBe(1);
  });
});
