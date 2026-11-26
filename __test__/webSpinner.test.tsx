/**
 * ViroSpinner on the web draws its built-in images from data URIs, which load
 * in bundlers without `require`, and still takes a custom source.
 */
const mockImages: any[] = [];
jest.mock("../components/ViroImage.web", () => ({
  ViroImage: (props: any) => {
    mockImages.push(props);
    return null;
  },
}));
jest.mock("../components/ViroNode.web", () => ({ ViroNode: (props: any) => props.children }));

import * as fs from "fs";
import * as path from "path";
import * as React from "react";
import { act } from "react";
import TestRenderer from "react-test-renderer";
import { ViroSpinner } from "../components/ViroSpinner.web";
import { viroSpinner1, viroSpinner1a, viroSpinner1aW, viroSpinner1W } from "../components/Web/viroSpinnerImages";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function sources(element: React.ReactElement) {
  mockImages.length = 0;
  act(() => {
    TestRenderer.create(element);
  });
  return mockImages.map((p) => p.source);
}

const png = (name: string) =>
  "data:image/png;base64," + fs.readFileSync(path.join(__dirname, "../components/Resources", `${name}.png`)).toString("base64");

describe("ViroSpinner on the web", () => {
  it("holds each built-in PNG as it is on disk", () => {
    expect(viroSpinner1).toBe(png("viro_spinner_1"));
    expect(viroSpinner1a).toBe(png("viro_spinner_1a"));
    expect(viroSpinner1W).toBe(png("viro_spinner_1_w"));
    expect(viroSpinner1aW).toBe(png("viro_spinner_1a_w"));
  });

  it("draws the dark pair by default and the light pair for either casing of Light", () => {
    expect(sources(<ViroSpinner />)).toEqual([viroSpinner1, viroSpinner1a]);
    expect(sources(<ViroSpinner type="Dark" />)).toEqual([viroSpinner1, viroSpinner1a]);
    expect(sources(<ViroSpinner type="Light" />)).toEqual([viroSpinner1W, viroSpinner1aW]);
    expect(sources(<ViroSpinner type="light" />)).toEqual([viroSpinner1W, viroSpinner1aW]);
  });

  it("takes a custom source and sourceReverse, each on its own", () => {
    const front = { uri: "https://example.com/front.png" };
    const back = { uri: "https://example.com/back.png" };
    expect(sources(<ViroSpinner source={front} sourceReverse={back} />)).toEqual([front, back]);
    expect(sources(<ViroSpinner type="Light" source={front} />)).toEqual([front, viroSpinner1aW]);
    expect(sources(<ViroSpinner sourceReverse={back} />)).toEqual([viroSpinner1, back]);
  });
});
