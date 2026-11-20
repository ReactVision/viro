/**
 * postProcessEffects follow the scene that is showing; the renderer has one VROScene for all of them.
 */
const mockScene = { setPostProcessEffects: jest.fn((e: string[]) => e.length) };
jest.mock("../components/Web/ViroWebContext", () => ({ useViroScene: () => mockScene }));

import * as React from "react";
import { act } from "react";
import TestRenderer from "react-test-renderer";
import { useViroPostProcessEffects } from "../components/Web/useViroPostProcessEffects";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function Scene({ effects }: { effects?: string[] }) {
  useViroPostProcessEffects(effects);
  return null;
}
const last = () => mockScene.setPostProcessEffects.mock.calls.at(-1)?.[0];

describe("postProcessEffects on the web", () => {
  it("applies the top scene's list, and the one below it once the top goes", () => {
    let a!: TestRenderer.ReactTestRenderer, b!: TestRenderer.ReactTestRenderer;
    act(() => {
      a = TestRenderer.create(<Scene effects={["grayscale"]} />);
    });
    expect(last()).toEqual(["grayscale"]);
    act(() => {
      b = TestRenderer.create(<Scene />);
    });
    expect(last()).toEqual([]);
    // A change below the top waits its turn.
    act(() => a.update(<Scene effects={["sepia"]} />));
    expect(last()).toEqual([]);
    act(() => b.unmount());
    expect(last()).toEqual(["sepia"]);
    act(() => a.unmount());
    expect(last()).toEqual([]);
  });

  it("warns once per unknown list, however often it is applied", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockScene.setPostProcessEffects.mockImplementation(() => 0);
    let t!: TestRenderer.ReactTestRenderer;
    act(() => {
      t = TestRenderer.create(<Scene effects={["swirly"]} />);
    });
    act(() => t.update(<Scene effects={["wobbly"]} />));
    act(() => t.update(<Scene effects={["swirly"]} />));
    expect(warn).toHaveBeenCalledTimes(2);
    act(() => t.unmount());
    warn.mockRestore();
  });
});
