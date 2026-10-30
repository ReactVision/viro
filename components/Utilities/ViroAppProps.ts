/**
 * Returns viroAppProps without the `rootTag` key React Native adds when the
 * root component's props are forwarded. The input is never modified, so frozen
 * objects (Redux, immer) are safe to pass.
 */
export function withoutRootTag<T extends { rootTag?: unknown }>(
  appProps: T | undefined
): Omit<T, "rootTag"> | undefined {
  if (!appProps || !appProps.rootTag) {
    return appProps;
  }
  const { rootTag: _rootTag, ...rest } = appProps;
  return rest;
}
