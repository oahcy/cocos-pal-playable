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

// i18n/en.ts
var en_exports = {};
__export(en_exports, {
  options: () => options,
  title: () => title
});
module.exports = __toCommonJS(en_exports);
var title = "Playable Ads";
var options = {
  "outputFormat": "Output format",
  "channel-default": "Channel default",
  "directory-zip": "Directory ZIP",
  "single-html": "Single HTML (format verification)",
  "imageCompression": "PNG compression",
  "imageQuality": "Image quality (1-100)",
  "none": "Disabled",
  "lossy": "Lossy",
  "channel": "Ad channel",
  "orientation": "Orientation",
  "auto": "Portrait and landscape",
  "portrait": "Portrait",
  "landscape": "Landscape"
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  options,
  title
});
