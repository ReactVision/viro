/**
 * The web scene navigators' history, held to the native navigators' semantics.
 */
import {
  jumpToScene,
  popScenes,
  pushScene,
  replaceScene,
  type WebSceneEntry,
} from "../components/Web/webSceneStack";

const A = () => null;
const B = () => null;
const C = () => null;
const root: WebSceneEntry[] = [{ key: "root", scene: A }];
const scenes = (h: WebSceneEntry[]) => h.map((e) => e.scene);

describe("web scene stack", () => {
  it("pushes a scene object with its passProps under a fresh tag", () => {
    const h = pushScene(root, { scene: B, passProps: { level: 2 } });
    expect(scenes(h)).toEqual([A, B]);
    expect(h[1].passProps).toEqual({ level: 2 });
    expect(h[1].key).not.toBe("root");
  });

  it("re-shows a scene pushed earlier by its tag alone", () => {
    const h = pushScene(pushScene(root, "menu", { scene: B }), { scene: C });
    expect(scenes(pushScene(h, "menu"))).toEqual([A, B, C, B]);
  });

  it("refuses a tag it has never seen", () => {
    expect(pushScene(root, "nope")).toBe(root);
  });

  it("jump moves a tag's last entry to the top instead of stacking it again", () => {
    const h = pushScene(pushScene(root, "b", { scene: B }), "c", { scene: C });
    const jumped = jumpToScene(h, "b");
    expect(scenes(jumped)).toEqual([A, C, B]);
    expect(jumped).toHaveLength(3);
  });

  it("replace swaps only the top", () => {
    const h = pushScene(root, { scene: B });
    expect(scenes(replaceScene(h, { scene: C }))).toEqual([A, C]);
  });

  it("never pops the root, and popN past it is refused outright", () => {
    expect(popScenes(root)).toBe(root);
    const h = pushScene(pushScene(root, { scene: B }), { scene: C });
    expect(popScenes(h, 3)).toBe(h);
    expect(scenes(popScenes(h, 2))).toEqual([A]);
  });
});
