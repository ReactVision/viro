import { ConfigPlugin } from "@expo/config-plugins";
import { withViroAndroid } from "./withViroAndroid";
import { withViroIos } from "./withViroIos";

const withViro: ConfigPlugin = (config) => {
  config = withViroIos(config);
  config = withViroAndroid(config);

  return config;
};

export default withViro;
