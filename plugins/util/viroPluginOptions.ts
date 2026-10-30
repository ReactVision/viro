import type { ViroConfigurationOptions } from "../withViro";

export const VIRO_PLUGIN_NAME = "@reactvision/react-viro";

/**
 * The options the plugin was called with. `props` is what Expo passes for a
 * `["@reactvision/react-viro", {...}]` entry, and is the only source when
 * another plugin calls withViro directly. The entry in `config.plugins` is the
 * fallback for callers that pass no props. A plugin registered without options
 * yields an empty object.
 */
export function resolveViroOptions(
  config: { plugins?: unknown[] },
  props?: ViroConfigurationOptions
): ViroConfigurationOptions {
  if (props) return props;
  const entry = config.plugins?.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === VIRO_PLUGIN_NAME
  );
  return (Array.isArray(entry) ? entry[1] : undefined) ?? {};
}
