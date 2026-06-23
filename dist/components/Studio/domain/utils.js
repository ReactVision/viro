"use strict";
// Small shared helpers for the Studio runtime domain.
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDev = void 0;
/** True only in a dev build; gates verbose runtime logging in the Studio stores. */
const isDev = () => typeof __DEV__ !== "undefined" && __DEV__;
exports.isDev = isDev;
