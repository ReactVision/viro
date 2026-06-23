// Small shared helpers for the Studio runtime domain.

/** True only in a dev build; gates verbose runtime logging in the Studio stores. */
export const isDev = (): boolean =>
  typeof __DEV__ !== "undefined" && __DEV__;
