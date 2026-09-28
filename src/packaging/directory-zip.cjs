'use strict';
const JSZip = require('jszip');
module.exports = async function encodeDirectoryZip(entries) {
  const zip = new JSZip();
  for (const entry of entries) zip.file(entry.name, entry.data, { date: new Date('2000-01-01T00:00:00Z'), createFolders: false });
  const data = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  return data;
};
