#!/usr/bin/env node
/*
  AYON — switch every emoji / text-symbol icon to Font Awesome.

  HOW TO RUN (from the  client  folder of your project):

      npm install react-icons
      node apply-fa-icons.js --dry      <- only shows what WOULD change (nothing is touched)
      node apply-fa-icons.js            <- does it

  - It edits YOUR current files in place, so nothing you changed recently is lost.
  - Before touching a file it saves a copy in  .icons-backup/  (same folder layout).
  - It is safe to run twice: the second run finds nothing left to change.
  - To undo everything: copy the files in .icons-backup/ back into src/
    (or just use  git checkout src  if you committed first).
*/
const fs = require('fs');
const path = require('path');

const DRY = process.argv.includes('--dry');
const SRC = path.resolve(process.argv.find((a, i) => i > 1 && !a.startsWith('--')) || 'src');
const BACKUP = path.resolve('.icons-backup');

if (!fs.existsSync(SRC)) {
  console.error(`Cannot find "${SRC}". Run this from the client folder (the one that contains src).`);
  process.exit(1);
}

/* ───────── what each old symbol becomes ───────── */
const CP = (s) => s.replace(/️/g, '');          // ignore emoji variation selector

// single symbol  ->  Font Awesome component
const ICON = {
  '⊞': 'FaTableCellsLarge',
  '📄': 'FaFileLines',
  '✚': 'FaCirclePlus',
  '🎓': 'FaHandHoldingDollar',
  '🗄': 'FaBoxArchive',
  '👤': 'FaUser',
  '📥': 'FaInbox',
  '📤': 'FaPaperPlane',
  '🔔': 'FaBell',
  '📋': 'FaClipboardList',
  '✗': 'FaCircleXmark',      // used as a menu icon ("Rejected")
  '👥': 'FaUsers',
  '🔑': 'FaKey',
  '📊': 'FaChartColumn',
  '✅': 'FaCircleCheck',
  '❌': 'FaCircleXmark',
  '✍': 'FaSignature',
  '📧': 'FaEnvelopeCircleCheck',
  '⚠': 'FaTriangleExclamation',
};
// symbols that sit INSIDE button text / labels
const INLINE = {
  '✓': 'FaCheck', '✗': 'FaXmark', '↩': 'FaRotateLeft', '⬆': 'FaUpload', '⬇': 'FaDownload',
  '📤': 'FaPaperPlane', '🗄': 'FaBoxArchive', '📋': 'FaClipboardList', '📄': 'FaFileLines',
};
// colours for big standalone icons (so they keep their meaning)
const BARE_STYLE = { '✅': "#276749", '⚠': "#b7791f" };

const used = new Set();
const note = (name) => { used.add(name); return name; };

function transform(src, file) {
  let s = src;
  const before = s;

  /* 1) menu / card icons:  icon: '📄'  */
  s = s.replace(/icon:\s*'([^'\n]+)'/g, (m, sym, offset) => {
    const key = CP(sym);
    const lineStart = s.lastIndexOf('\n', offset) + 1;
    const lineEnd = s.indexOf('\n', offset);
    const line = s.slice(lineStart, lineEnd === -1 ? s.length : lineEnd);
    const label = (line.match(/label:\s*'([^']*)'/) || [])[1] || '';
    let comp = ICON[key];
    if (key === '✅' && /validate/i.test(label)) comp = 'FaClipboardCheck';
    return comp ? `icon: <${note(comp)} />` : m;
  });

  /* 2) Layout: collapse arrow + logout */
  s = s.replace(/\{collapsed \? '›' : '‹'\}/g,
    () => `{collapsed ? <${note('FaChevronRight')} /> : <${note('FaChevronLeft')} />}`);
  s = s.replace(/⎋ /g, () => `<${note('FaRightFromBracket')} className="ic" />`);

  /* 3) quoted button text:  'Processing...' : '✓ Endorse'  */
  s = s.replace(/'(✓|✗|📤|⬆|⬇|🗄)️? ([^'\n]+)'/g,
    (m, sym, text) => `<><${note(INLINE[sym])} className="ic" />${text}</>`);

  /* 4) quoted single symbol:  '✓'   '🔔'   '✅' ...  */
  s = s.replace(/'(✓|📤|📋|✍|✅|❌|🔔)️?'/g, (m, sym) => {
    const comp = sym === '✓' ? 'FaCheck' : ICON[sym];
    return `<${note(comp)} />`;
  });

  /* 5) symbols alone between tags:  >✅</div>   >🔔</p>  */
  s = s.replace(/>\s*(✅|⚠|📧|🔔)️?\s*</g, (m, sym) => {
    const col = BARE_STYLE[sym];
    const style = col ? ` style={{ color: '${col}' }}` : '';
    return `><${note(ICON[sym])}${style} /><`;
  });

  /* 6) notification icon box: give the icon the maroon colour */
  s = s.replace(/<div style=\{\{ fontSize: '1\.3rem', flexShrink: 0, lineHeight: 1\.2 \}\}>/g,
    `<div style={{ fontSize: '1.3rem', flexShrink: 0, lineHeight: 1.2, color: '#8d1b2d', width: 28, textAlign: 'center' }}>`);

  /* 7) wave emoji in the welcome line */
  s = s.replace(/\s?👋️?/g, '');

  /* 8) arrows and symbols inside plain JSX text */
  s = s.replace(/ →/g, () => ` <${note('FaArrowRight')} className="ic-r" />`);
  s = s.replace(/← /g, () => `<${note('FaArrowLeft')} className="ic" />`);
  s = s.replace(/(✓|✗|↩|⬆|⬇|📤|🗄|📋|📄)️? /g,
    (m, sym) => `<${note(INLINE[sym])} className="ic" />`);

  if (s === before) return { out: src, changed: false };

  /* 9) add the import after the last import line at the top of the file */
  const names = [...new Set([...s.matchAll(/<(Fa[A-Za-z0-9]+)\b/g)].map((x) => x[1]))].sort();
  if (names.length && !/from 'react-icons\/fa6'/.test(s)) {
    const eol = s.includes('\r\n') ? '\r\n' : '\n';
    const lines = s.split(/\r?\n/);
    let last = -1;
    for (let i = 0; i < Math.min(lines.length, 60); i++) {
      if (/^import\s.+from\s+['"].+['"];?\s*$/.test(lines[i]) || /^import\s+['"].+['"];?\s*$/.test(lines[i])) last = i;
    }
    lines.splice(last + 1, 0, `import { ${names.join(', ')} } from 'react-icons/fa6';`);
    s = lines.join(eol);
  }
  return { out: s, changed: true };
}

/* ───────── walk src ───────── */
function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, out);
    else if (/\.(js|jsx)$/.test(f.name)) out.push(p);
  }
  return out;
}

const report = [];
for (const file of walk(SRC)) {
  used.clear();
  const src = fs.readFileSync(file, 'utf8');
  const { out, changed } = transform(src, file);
  if (!changed) continue;
  report.push(path.relative(SRC, file));
  if (!DRY) {
    const bk = path.join(BACKUP, path.relative(SRC, file));
    if (!fs.existsSync(bk)) { fs.mkdirSync(path.dirname(bk), { recursive: true }); fs.copyFileSync(file, bk); }
    fs.writeFileSync(file, out, 'utf8');
  }
}

/* ───────── small CSS additions (added once) ───────── */
const CSS_MARK = '/* ── AYON Font Awesome icons ── */';
const LAYOUT_CSS = path.join(SRC, 'components', 'Layout.css');
const CSS_BLOCK = `
${CSS_MARK}
.ic   { vertical-align: -0.125em; margin-right: 0.45em; }
.ic-r { vertical-align: -0.125em; margin-left: 0.2em; }
.nav-icon { display: inline-flex; align-items: center; justify-content: center; width: 1.3rem; }
.logout-btn svg { width: 1rem; height: 1rem; }
.layout.collapsed .logout-btn svg { margin-right: 0; }
`;
let cssNote = 'Layout.css: not found (skipped)';
if (fs.existsSync(LAYOUT_CSS)) {
  const css = fs.readFileSync(LAYOUT_CSS, 'utf8');
  if (css.includes(CSS_MARK)) cssNote = 'Layout.css: already has the icon styles';
  else {
    cssNote = 'Layout.css: icon styles added';
    if (!DRY) {
      const bk = path.join(BACKUP, 'components', 'Layout.css');
      if (!fs.existsSync(bk)) { fs.mkdirSync(path.dirname(bk), { recursive: true }); fs.copyFileSync(LAYOUT_CSS, bk); }
      fs.writeFileSync(LAYOUT_CSS, css + CSS_BLOCK, 'utf8');
    }
  }
}
const SLIDER_CSS = path.join(SRC, 'pages', 'AuthSlider.css');
if (fs.existsSync(SLIDER_CSS)) {
  const css = fs.readFileSync(SLIDER_CSS, 'utf8');
  if (!css.includes('.as-done-icon { color')) {
    if (!DRY) {
      const bk = path.join(BACKUP, 'pages', 'AuthSlider.css');
      if (!fs.existsSync(bk)) { fs.mkdirSync(path.dirname(bk), { recursive: true }); fs.copyFileSync(SLIDER_CSS, bk); }
      fs.writeFileSync(SLIDER_CSS, css + '\n.as-done-icon { color: #8d1b2d; }\n', 'utf8');
    }
  }
}

/* ───────── summary + anything we did not handle ───────── */
console.log(DRY ? '\nDRY RUN — nothing was changed.\n' : '\nDone.\n');
console.log(report.length ? 'Files changed:' : 'No files needed changes (already converted).');
report.forEach((f) => console.log('  • ' + f));
console.log('\n' + cssNote);

const LEFTOVER = /[\u{1F300}-\u{1FAFF}☀-➿⬀-⯿←-⇿⊞⎋]/u;
const left = [];
for (const file of walk(SRC)) {
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, i) => {
    if (LEFTOVER.test(line)) left.push(`  ${path.relative(SRC, file)}:${i + 1}  ${line.trim().slice(0, 90)}`);
  });
}
if (left.length && DRY) {
  console.log(`\n${left.length} lines with an emoji/symbol would be converted (dry run, not changed yet).`);
} else if (left.length) {
  console.log('\nStill using a symbol/emoji (send me this list and I will convert them too):');
  left.forEach((l) => console.log(l));
} else if (!DRY) {
  console.log('\nNo emoji or symbol icons left in src/.');
}
if (!DRY && report.length) {
  console.log('\nNext: make sure you ran  npm install react-icons  then restart  npm start.');
  console.log('Backups of the original files are in  .icons-backup/');
}