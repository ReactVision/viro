/**
 * Copyright © 2026 ReactVision. All rights reserved.
 *
 * A native module reference that survives the platform not having it.
 *
 * `NativeModules.X` is `null` when X is not registered, and a whole subsystem can be absent by
 * design: the AR view managers and their modules are excluded from the visionOS renderer, and the
 * OpenXR ones only exist in a Quest build. A component that guards its `render` still has
 * lifecycle and imperative methods that run — `componentWillUnmount` calling `cleanup` is the one
 * that bit us — and those turn a supported-but-limited platform into a crash with a message that
 * names none of this: *"Cannot read property 'cleanup' of null"*.
 *
 * Every method on the stand-in resolves to `undefined` instead, and says once which module and
 * method were missing. Resolving rather than rejecting is deliberate: most of these calls are made
 * for effect and never awaited, and a rejected promise nobody catches is a second failure on top
 * of the first.
 */

const warned = new Set<string>();

function warnMissing(moduleName: string, method: string): void {
  const key = `${moduleName}.${method}`;
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(
    `[Viro] ${key} is not available on this platform; the call did nothing.`
  );
}

/**
 * @param nativeModule what `NativeModules.<name>` gave back, which may be null or undefined
 * @param moduleName   the name it is registered under, for the warning
 */
export function withMissingModuleFallback<T extends object>(
  nativeModule: T | null | undefined,
  moduleName: string
): T {
  if (nativeModule) return nativeModule;

  return new Proxy({} as T, {
    get(_target, property) {
      // React and the runtime probe objects for these; answering with a function confuses
      // promise resolution and console output.
      if (
        property === "then" ||
        property === Symbol.toPrimitive ||
        property === Symbol.toStringTag ||
        property === "toJSON"
      ) {
        return undefined;
      }
      const method = String(property);
      return (..._args: unknown[]) => {
        warnMissing(moduleName, method);
        return Promise.resolve(undefined);
      };
    },
  });
}

/** Test seam: forgets what has already been warned about. */
export function resetMissingModuleWarnings(): void {
  warned.clear();
}
