// Generated from TypeScript. Do not edit.
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// i18n/zh.ts
var zh_exports = {};
__export(zh_exports, {
  options: () => options,
  title: () => title
});
module.exports = __toCommonJS(zh_exports);
var title = "\u8BD5\u73A9\u5E7F\u544A";
var options = {
  "channel": "\u5E7F\u544A\u6E20\u9053",
  "orientation": "\u5C4F\u5E55\u65B9\u5411",
  "auto": "\u6A2A\u7AD6\u5C4F\u81EA\u9002\u5E94",
  "portrait": "\u7AD6\u5C4F",
  "landscape": "\u6A2A\u5C4F"
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  options,
  title
});
