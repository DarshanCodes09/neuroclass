const fs = require('fs/promises');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const JSZip = require('jszip');

function stripXmlTags(xml = '') {
  return xml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

async function parsePptx(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const slidePaths = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const chunks = [];
  for (const slidePath of slidePaths) {
    const xml = await zip.file(slidePath).async('text');
    chunks.push(stripXmlTags(xml));
  }
  return chunks.join('\n');
}

async function extractTextFromFile(filePath, fallbackOriginalName = '') {
  const ext = path.extname(fallbackOriginalName || filePath).toLowerCase();
  const buffer = await fs.readFile(filePath);

  if (ext === '.pdf') {
    const data = await pdfParse(buffer);
    return (data.text || '').trim();
  }

  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ buffer });
    return (result.value || '').trim();
  }

  if (ext === '.pptx') {
    return parsePptx(buffer);
  }

  if (ext === '.txt' || ext === '.doc' || ext === '.ppt') {
    return buffer.toString('utf8').trim();
  }

  return '';
}

module.exports = {
  extractTextFromFile,
};
