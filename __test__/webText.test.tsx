/**
 * ViroText on the web reads native's style props: a family, weight and italic
 * (in Roboto, fetched per face), extrusion and an outer stroke.
 */
const mockScene: Record<string, any> = {
  supportsTextStyle: true,
  createText: jest.fn(() => 11),
  createStyledText: jest.fn(() => 12),
};
let mockFaceLoads: { weight: number; italic: boolean; resolve: (ok: boolean) => void }[] = [];
const mockRenderer: Record<string, any> = {
  loadTextFace: jest.fn(
    (weight: number, italic: boolean) => new Promise<boolean>((resolve) => mockFaceLoads.push({ weight, italic, resolve })),
  ),
};
const mockNodeProps: any[] = [];
jest.mock("../components/Web/ViroWebContext", () => {
  const React = require("react");
  return {
    useViroScene: () => mockScene,
    useViroRenderer: () => mockRenderer,
    ViroParentNodeContext: React.createContext(0),
  };
});
jest.mock("../components/Web/useViroNode", () => {
  const React = require("react");
  return {
    useViroNode: (props: any, create: (scene: any) => number, _ready: boolean, key: string) => {
      mockNodeProps.push(props);
      React.useMemo(() => create(mockScene), [key]);
      return 1;
    },
  };
});

import * as React from "react";
import { act } from "react";
import TestRenderer from "react-test-renderer";
import { ViroText } from "../components/ViroText.web";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const styleOf = (call: number) => (mockScene.createStyledText.mock.calls[call] as any[])[10];

function mount(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(element);
  });
  return tree;
}

const createStyledText = mockScene.createStyledText;
const loadTextFace = mockRenderer.loadTextFace;

beforeEach(() => {
  jest.clearAllMocks();
  mockFaceLoads = [];
  mockNodeProps.length = 0;
  mockScene.supportsTextStyle = true;
  mockScene.createStyledText = createStyledText;
  mockRenderer.loadTextFace = loadTextFace;
});

describe("ViroText on the web", () => {
  it("draws unstyled text, and a family alone (Studio's Arial), as before", () => {
    mount(<ViroText text="Hi" style={{ fontSize: 30, color: "#ff0000" }} />);
    mount(<ViroText text="Hi" style={{ fontFamily: "Arial" }} />);
    expect(mockScene.createText).toHaveBeenCalledTimes(2);
    expect(mockScene.createStyledText).not.toHaveBeenCalled();
    expect(mockRenderer.loadTextFace).not.toHaveBeenCalled();
  });

  it("draws in the regular face until the requested one has loaded", async () => {
    mount(<ViroText text="Hi" style={{ fontFamily: "Arial", fontWeight: "bold", fontStyle: "italic" }} />);
    expect(styleOf(0)).toMatchObject({ typefaces: "Arial", weight: 400, italic: false });
    expect(mockFaceLoads.map(({ weight, italic }) => [weight, italic])).toEqual([[700, true]]);

    await act(async () => mockFaceLoads[0]!.resolve(true));
    expect(styleOf(1)).toMatchObject({ typefaces: "Arial", weight: 700, italic: true });
  });

  it("stays in the regular face when the requested one cannot be had", async () => {
    mount(<ViroText text="Hi" style={{ fontWeight: 650 }} />);
    expect(mockFaceLoads[0]!.weight).toBe(700);
    await act(async () => mockFaceLoads[0]!.resolve(false));
    expect(mockScene.createStyledText).toHaveBeenCalledTimes(1);
    expect(styleOf(0)).toMatchObject({ weight: 400 });
  });

  it("reads weights and strokes the way iOS does", () => {
    mount(<ViroText text="Hi" style={{ fontWeight: "600" }} outerStroke={{ type: "Outline" }} />);
    expect(mockFaceLoads[0]!.weight).toBe(600);
    // A stroke with no width is 0 wide, as iOS reads a missing number.
    expect(styleOf(0)).toMatchObject({ stroke: 1, strokeWidth: 0, strokeColor: { r: 1, g: 1, b: 1, a: 1 } });

    mount(<ViroText text="Hi" style={{ fontWeight: "heavy" as any }} outerStroke={{ type: "dropshadow" as any, width: 3.7, color: "#000000" }} />);
    expect(styleOf(1)).toMatchObject({ weight: 400, stroke: 2, strokeWidth: 3, strokeColor: { r: 0, g: 0, b: 0, a: 1 } });
  });

  it("dresses only extruded text in its materials", () => {
    mount(<ViroText text="Flat" materials={["gold"]} />);
    expect(mockNodeProps.at(-1).materials).toBeUndefined();
    mount(<ViroText text="Deep" extrusionDepth={4} materials={["gold"]} />);
    expect(mockNodeProps.at(-1).materials).toEqual(["gold"]);
    expect(styleOf(0)).toMatchObject({ extrusion: 4 });
  });

  it("draws plain text, and says so, on a renderer from before styled text", () => {
    delete mockScene.supportsTextStyle;
    delete mockScene.createStyledText;
    delete mockRenderer.loadTextFace;
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    mount(<ViroText text="Hi" style={{ fontFamily: "Arial" }} />);
    expect(warn).not.toHaveBeenCalled();
    mount(<ViroText text="Hi" style={{ fontWeight: "bold" }} extrusionDepth={2} />);
    expect(mockScene.createText).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("extrusionDepth"));
    warn.mockRestore();
  });
});
