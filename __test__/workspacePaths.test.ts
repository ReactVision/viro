import { describe, expect, test } from "@jest/globals";
import fs from "fs";
import os from "os";
import path from "path";
import { resolveViroAndroidRelativePath } from "../plugins/withViroAndroid";
import { resolveViroIosRelativePath } from "../plugins/withViroIos";

function createPackageAt(packageRoot: string): void {
  fs.mkdirSync(path.join(packageRoot, "android"), { recursive: true });
  fs.mkdirSync(path.join(packageRoot, "ios"), { recursive: true });
  fs.writeFileSync(
    path.join(packageRoot, "package.json"),
    JSON.stringify({ name: "@reactvision/react-viro", version: "0.0.0" })
  );
}

describe("workspace path resolution", () => {
  function tempRoot(): string {
    // require.resolve resolves the real path; on macOS /var is a symlink to
    // /private/var, so build under realpath to keep both sides consistent.
    return fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "viro-plugin-"));
  }

  test("resolves android path for a hoisted monorepo layout", () => {
    const root = tempRoot();
    try {
      // App lives at <root>/apps/assisteo, package hoisted to <root>/node_modules
      const app = path.join(root, "apps", "assisteo");
      createPackageAt(path.join(root, "node_modules", "@reactvision", "react-viro"));
      expect(resolveViroAndroidRelativePath(app, path.join(app, "android"))).toBe(
        "../../../node_modules/@reactvision/react-viro/android"
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("resolves android path for a flat (non-workspace) layout", () => {
    const root = tempRoot();
    try {
      const app = path.join(root, "app");
      createPackageAt(path.join(app, "node_modules", "@reactvision", "react-viro"));
      expect(resolveViroAndroidRelativePath(app, path.join(app, "android"))).toBe(
        "../node_modules/@reactvision/react-viro/android"
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("falls back when the package cannot be resolved", () => {
    const root = tempRoot();
    try {
      expect(resolveViroAndroidRelativePath(root, path.join(root, "android"))).toBe(
        "../node_modules/@reactvision/react-viro/android"
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("resolves ios path for a hoisted monorepo layout", () => {
    const root = tempRoot();
    try {
      const app = path.join(root, "apps", "assisteo");
      createPackageAt(path.join(root, "node_modules", "@reactvision", "react-viro"));
      expect(resolveViroIosRelativePath(app, path.join(app, "ios"))).toBe(
        "../../../node_modules/@reactvision/react-viro/ios"
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("resolves ios path for a flat (non-workspace) layout", () => {
    const root = tempRoot();
    try {
      const app = path.join(root, "app");
      createPackageAt(path.join(app, "node_modules", "@reactvision", "react-viro"));
      expect(resolveViroIosRelativePath(app, path.join(app, "ios"))).toBe(
        "../node_modules/@reactvision/react-viro/ios"
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("falls back when the package cannot be resolved", () => {
    const root = tempRoot();
    try {
      expect(resolveViroIosRelativePath(root, path.join(root, "ios"))).toBe(
        "../node_modules/@reactvision/react-viro/ios"
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
