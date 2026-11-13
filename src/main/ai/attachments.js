const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* Ported from NexNotch's AI attachment pipeline.
   The renderer never reads arbitrary files itself: it asks the main process
   for a normalized attachment, which keeps file access behind the IPC
   boundary and lets us support docx/odt without extra dependencies. */

const MAX_TEXT_CHARS = 48000;
const MAX_PLAIN_BYTES = 4 * 1024 * 1024;
const MAX_DOC_BYTES = 30 * 1024 * 1024;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.markdown', '.rst', '.log', '.csv', '.tsv', '.json',
  '.jsonl', '.yaml', '.yml', '.toml', '.ini', '.conf', '.cfg', '.env',
  '.xml', '.html', '.htm', '.css', '.scss', '.js', '.mjs', '.cjs',
  '.ts', '.tsx', '.jsx', '.py', '.sh', '.bash', '.zsh', '.c', '.h',
  '.cpp', '.hpp', '.cc', '.rs', '.go', '.java', '.kt', '.php', '.rb',
  '.pl', '.lua', '.sql', '.desktop', '.service', '.srt', '.vtt',
]);

const IMAGE_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
};

const MIME_BY_EXT = {
  '.txt': 'text/plain', '.md': 'text/markdown', '.json': 'application/json',
  '.csv': 'text/csv', '.log': 'text/plain', '.xml': 'application/xml',
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.ts': 'text/typescript', '.py': 'text/x-python', '.sh': 'text/x-shellscript',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.odt': 'application/vnd.oasis.opendocument.text',
};

function mimeFor(name) {
  return MIME_BY_EXT[path.extname(name).toLowerCase()] || 'application/octet-stream';
}

function isTextual(name) {
  const ext = path.extname(name).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

function truncate(text) {
  const clean = String(text || '').replace(/\u0000/g, '').trim();
  if (!clean) return null;
  if (clean.length <= MAX_TEXT_CHARS) return clean;
  return `${clean.slice(0, MAX_TEXT_CHARS)}\n\n[... dipotong, file terlalu panjang ...]`;
}

/* Minimal ZIP reader for docx/odt. Handles stored + deflated entries and
   the common case where the archive has no ZIP64 extra fields. */
function readZipEntry(filePath, entryName) {
  const buf = fs.readFileSync(filePath);

  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Bukan arsip ZIP yang valid');

  const entries = buf.readUInt16LE(eocd + 10);
  let ptr = buf.readUInt32LE(eocd + 16);

  for (let i = 0; i < entries; i++) {
    if (buf.readUInt32LE(ptr) !== 0x02014b50) break;
    const method = buf.readUInt16LE(ptr + 10);
    const compressedSize = buf.readUInt32LE(ptr + 20);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localOffset = buf.readUInt32LE(ptr + 42);
    const name = buf.toString('utf8', ptr + 46, ptr + 46 + nameLen);

    if (name === entryName) {
      if (buf.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('Header ZIP rusak');
      const localNameLen = buf.readUInt16LE(localOffset + 26);
      const localExtraLen = buf.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLen + localExtraLen;
      const raw = buf.subarray(dataStart, dataStart + compressedSize);
      if (method === 0) return raw;
      if (method === 8) return zlib.inflateRawSync(raw);
      throw new Error(`Metode kompresi ZIP ${method} tidak didukung`);
    }
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

function stripXml(xml, isDocx) {
  let s = String(xml || '');
  if (isDocx) {
    s = s.replace(/<w:tab[^>]*\/>/g, '\t')
         .replace(/<w:br[^>]*\/>/g, '\n')
         .replace(/<\/w:p>/g, '\n')
         .replace(/<\/w:tc>/g, '\t')
         .replace(/<\/w:tr>/g, '\n');
  } else {
    s = s.replace(/<text:tab[^>]*\/>/g, '\t')
         .replace(/<text:line-break[^>]*\/>/g, '\n')
         .replace(/<\/(?:text:p|text:h)>/g, '\n');
  }
  s = s.replace(/<[^>]*>/g, '');
  s = s.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
       .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
       .replace(/&#(\d+);/g, (_m, d) => {
         try { return String.fromCodePoint(Number(d)); } catch (_) { return ''; }
       })
       .replace(/&#x([0-9a-fA-F]+);/g, (_m, h) => {
         try { return String.fromCodePoint(parseInt(h, 16)); } catch (_) { return ''; }
       })
       .replace(/&amp;/g, '&');
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Normalize a local file into something the AI panel can consume.
 * @returns {{ok: true, kind: 'image', name: string, mime: string, base64: string}
 *          |{ok: true, kind: 'text', name: string, mime: string, text: string, size: number}
 *          |{ok: false, error: string}}
 */
function loadAttachment(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return { ok: false, error: 'Bukan file biasa' };

    const name = path.basename(filePath);
    const ext = path.extname(name).toLowerCase();
    const mime = mimeFor(name);
    const imageMime = IMAGE_TYPES[ext];

    if (imageMime) {
      if (stat.size > MAX_IMAGE_BYTES) {
        return { ok: false, error: `Gambar terlalu besar (maks ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB)` };
      }
      return {
        ok: true,
        kind: 'image',
        name,
        mime: imageMime,
        base64: fs.readFileSync(filePath).toString('base64'),
      };
    }

    if (ext === '.docx' || ext === '.odt') {
      if (stat.size > MAX_DOC_BYTES) {
        return { ok: false, error: `Dokumen terlalu besar (maks ${Math.round(MAX_DOC_BYTES / 1024 / 1024)} MB)` };
      }
      const entry = ext === '.docx' ? 'word/document.xml' : 'content.xml';
      const xml = readZipEntry(filePath, entry);
      if (!xml) return { ok: false, error: 'Isi dokumen tidak ditemukan' };
      const text = truncate(stripXml(xml.toString('utf8'), ext === '.docx'));
      if (!text) return { ok: false, error: 'Dokumen tidak berisi teks' };
      return { ok: true, kind: 'text', name, mime, text, size: stat.size };
    }

    if (!isTextual(name)) {
      return {
        ok: false,
        error: 'Format belum didukung. Gunakan gambar (PNG/JPG/WebP/GIF), file teks/kode, atau dokumen Word (.docx) / ODT.',
      };
    }
    if (stat.size > MAX_PLAIN_BYTES) {
      return { ok: false, error: `File teks terlalu besar (maks ${Math.round(MAX_PLAIN_BYTES / 1024 / 1024)} MB)` };
    }

    const text = truncate(fs.readFileSync(filePath).toString('utf8'));
    if (!text) return { ok: false, error: 'File tidak berisi teks yang bisa dibaca' };
    return { ok: true, kind: 'text', name, mime, text, size: stat.size };
  } catch (e) {
    return { ok: false, error: e.message || 'Gagal membaca file' };
  }
}

module.exports = { loadAttachment };
