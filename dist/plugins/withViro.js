"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const withViroAndroid_1 = require("./withViroAndroid");
const withViroIos_1 = require("./withViroIos");
const withViro = (config) => {
    config = (0, withViroIos_1.withViroIos)(config);
    config = (0, withViroAndroid_1.withViroAndroid)(config);
    return config;
};
exports.default = withViro;
