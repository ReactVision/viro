/**
 * A restored WebGL context gives a navigator a new renderer generation.
 */
import * as React from "react";
import { act } from "react";
import TestRenderer from "react-test-renderer";
import { useViroContextRestore } from "../components/Web/useViroContextRestore";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function harness(renderer: any) {
  const seen: number[] = [];
  const clear = jest.fn();
  function Probe() {
    seen.push(useViroContextRestore(renderer, clear));
    return null;
  }
  act(() => {
    TestRenderer.create(<Probe />);
  });
  return { seen, clear };
}

describe("useViroContextRestore", () => {
  it("clears the renderer and bumps the generation once the context is back", () => {
    let listener: any;
    const unsubscribe = jest.fn();
    const renderer = { addContextListener: jest.fn((l) => ((listener = l), unsubscribe)) };
    const { seen, clear } = harness(renderer);
    expect(seen.at(-1)).toBe(0);

    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    act(() => listener.onLost());
    expect(clear).not.toHaveBeenCalled();
    expect(seen.at(-1)).toBe(0);
    warn.mockRestore();

    act(() => listener.onRestored());
    expect(clear).toHaveBeenCalledTimes(1);
    expect(seen.at(-1)).toBe(1);
  });

  it("stays at the first generation on a renderer that reports no context loss", () => {
    const { seen } = harness({});
    expect(seen).toEqual([0]);
  });
});
