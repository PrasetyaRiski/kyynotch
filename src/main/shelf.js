const fs = require('fs');
const path = require('path');
const { app, shell, dialog } = require('electron');

/* Ported from NexNotch's Drop Shelf module.
   Files live in userData (not cache) so a cache cleaner cannot delete them. */

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg', '.avif']);

function shelfDir() {
  return path.join(app.getPath('userData'), 'shelf');
}

function ensureDir() {
  const dir = shelfDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

function isInsideShelf(filePath) {
  if (!filePath) return false;
  const dir = path.resolve(shelfDir());
  const target = path.resolve(filePath);
  return target === dir || target.startsWith(dir + path.sep);
}

function safeName(name) {
  const dir = ensureDir();
  const ext = path.extname(name);
  const base = path.basename(name, ext).replace(/[\\/:*?"<>|]/g, '_').slice(0, 120) || 'file';
  let candidate = path.join(dir, `${base}${ext}`);
  if (!fs.existsSync(candidate)) return candidate;

  const stamp = Math.floor(Date.now() / 1000);
  for (let i = 0; i < 100; i++) {
    const suffix = i === 0 ? `${stamp}` : `${stamp}-${i}`;
    candidate = path.join(dir, `${base}-${suffix}${ext}`);
    if (!fs.existsSync(candidate)) return candidate;
  }
  return path.join(dir, `${base}-${Date.now()}${ext}`);
}

function describe(filePath) {
  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  return {
    name: path.basename(filePath),
    path: filePath,
    size: stat.size,
    mtime: stat.mtimeMs,
    ext,
    isImage: IMAGE_EXTS.has(ext),
  };
}

function list() {
  const dir = ensureDir();
  const items = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    try {
      const stat = fs.statSync(full);
      if (!stat.isFile()) continue;
      items.push(describe(full));
    } catch (_) {}
  }
  return items.sort((a, b) => b.mtime - a.mtime);
}

function addFiles(filePaths) {
  ensureDir();
  const added = [];
  for (const src of filePaths || []) {
    try {
      if (typeof src !== 'string' || !src) continue;
      const stat = fs.statSync(src);
      if (!stat.isFile()) continue;

      const resolved = path.resolve(src);
      // Dropping a file that already lives in the shelf must not duplicate it.
      if (isInsideShelf(resolved)) continue;

      const dest = safeName(path.basename(resolved));
      fs.copyFileSync(resolved, dest);
      added.push(describe(dest));
    } catch (_) {}
  }
  return added;
}

function remove(filePath) {
  if (!isInsideShelf(filePath)) return false;
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch (_) {
    return false;
  }
}

function clear() {
  const dir = ensureDir();
  try {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (fs.statSync(full).isFile()) fs.unlinkSync(full);
    }
  } catch (_) {}
}

function reveal(filePath) {
  if (!isInsideShelf(filePath)) return false;
  try {
    shell.showItemInFolder(filePath);
    return true;
  } catch (_) {
    return false;
  }
}

async function pickFiles() {
  const win = require('./window').getMainWindow();
  const result = await dialog.showOpenDialog(win || undefined, {
    title: 'Pilih File untuk Drop Shelf',
    properties: ['openFile', 'multiSelections'],
  });
  if (result.canceled) return [];
  return addFiles(result.filePaths);
}

module.exports = {
  shelfDir,
  list,
  addFiles,
  remove,
  clear,
  reveal,
  pickFiles,
  isInsideShelf,
};
