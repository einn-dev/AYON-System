const supabase = require('../config/supabase');

/* ─────────────────────────────────────────────────────────────
   The documents of a proposal (table proposal_files).
   Every proposal has at most one Main Proposal Document and up to
   MAX_SUPPORTING supporting documents, each with a label.
   research_proposals.file_path always holds the main document too,
   so older screens that only know file_path keep working.
   ───────────────────────────────────────────────────────────── */

const MAX_MB          = 10;
const MAX_SUPPORTING  = 4;
const MAX_FILES       = 1 + MAX_SUPPORTING;
const LABEL_MAX       = 60;
const MAIN_LABEL      = 'Main Proposal Document';

/* the labels the form offers; "Other" lets the researcher type their own */
const SUPPORTING_LABELS = [
  'Line-Item Budget', 'Endorsement Letter', 'Curriculum Vitae',
  'Ethics Clearance', 'Certificate of Acceptance',
];

const ALLOWED_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const bucket = () => supabase.storage.from(process.env.SUPABASE_BUCKET);

/* "Line-Item Budget", "  my label " → trimmed text, or '' */
const cleanLabel = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

/* The labels sent with the supporting files: a JSON array, or one plain text */
const readLabels = (raw) => {
  if (raw === undefined || raw === null || raw === '') return [];
  if (Array.isArray(raw)) return raw.map(cleanLabel);
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(cleanLabel) : [cleanLabel(v)];
  } catch {
    return [cleanLabel(raw)];
  }
};

/* A list of file ids to remove: JSON array or "1,2,3" */
const readIds = (raw) => {
  if (raw === undefined || raw === null || raw === '') return [];
  let list = raw;
  if (!Array.isArray(list)) {
    try { list = JSON.parse(raw); } catch { list = String(raw).split(','); }
  }
  return [...new Set([].concat(list).map(Number).filter(n => Number.isInteger(n) && n > 0))];
};

/* The new files in the request: { main, supporting: [{ file, label }] }, or { error } */
const readUpload = (req) => {
  const files      = req.files || {};
  const main       = (files.file || [])[0] || null;
  const supporting = files.supporting || [];
  const labels     = readLabels((req.body || {}).supporting_labels);

  if (supporting.length > MAX_SUPPORTING) {
    return { error: `You can attach at most ${MAX_SUPPORTING} supporting documents.` };
  }
  const list = [];
  for (let i = 0; i < supporting.length; i += 1) {
    const label = labels[i] || '';
    if (!label) return { error: `Please give supporting document ${i + 1} a label (for example "Line-Item Budget").` };
    if (label.length > LABEL_MAX) return { error: `A document label must be ${LABEL_MAX} characters or fewer.` };
    list.push({ file: supporting[i], label });
  }
  return { main, supporting: list };
};

/* the original file name, safe to show (multer gives it as latin1) */
const originalName = (f) => {
  let name = String(f?.originalname || 'document');
  try { name = Buffer.from(name, 'latin1').toString('utf8'); } catch { /* keep it */ }
  return name.replace(/[\\/]/g, '_').slice(0, 255);
};

/* Puts one file in Supabase Storage. Returns { file_path, storage_key, ... } */
const putFile = async (f, folder = 'proposals') => {
  const ext = (originalName(f).split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'pdf';
  const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await bucket().upload(key, f.buffer, { contentType: f.mimetype, upsert: false });
  if (error) throw error;
  const { data } = bucket().getPublicUrl(key);
  return {
    file_path:   data?.publicUrl || key,
    storage_key: key,
    file_name:   originalName(f),
    file_size:   f.size || (f.buffer ? f.buffer.length : null),
    mime_type:   f.mimetype || null,
  };
};

/* Deletes files from Storage. Best effort: never throws. */
const removeKeys = async (keys) => {
  const list = [...new Set((keys || []).filter(Boolean))];
  if (!list.length) return;
  try {
    const { error } = await bucket().remove(list);
    if (error) throw error;
  } catch (err) {
    console.error('Storage remove failed:', err.message || err);
  }
};

/* Storage key from a public address (older rows saved only the address) */
const keyFromPath = (fp) => {
  const m = String(fp || '').match(/\/object\/public\/[^/]+\/(.+)$/);
  return m ? decodeURIComponent(m[1].split('?')[0]) : null;
};

/* Uploads the new files first (so nothing is saved if an upload fails).
   Returns the rows to insert, without proposal_id. On failure it removes
   whatever it already uploaded and throws. */
const uploadAll = async ({ main, supporting }, userId) => {
  const done = [];
  try {
    if (main) done.push({ kind: 'main', label: MAIN_LABEL, uploaded_by: userId, ...(await putFile(main)) });
    for (const s of supporting || []) {
      done.push({ kind: 'supporting', label: s.label, uploaded_by: userId, ...(await putFile(s.file)) });
    }
    return done;
  } catch (err) {
    await removeKeys(done.map(d => d.storage_key));
    throw err;
  }
};

/* The documents of one proposal, main first */
const sortFiles = (rows) => [...(rows || [])].sort((a, b) =>
  (a.kind === 'main' ? 0 : 1) - (b.kind === 'main' ? 0 : 1) || Number(a.file_id) - Number(b.file_id));

const listFiles = async (proposalId) => {
  const { data, error } = await supabase
    .from('proposal_files').select('*').eq('proposal_id', proposalId);
  if (error) throw error;
  return sortFiles(data);
};

/* What the screens get for each document */
const publicFile = (f) => ({
  file_id:     f.file_id ?? null,
  kind:        f.kind,
  label:       f.label,
  file_name:   f.file_name || null,
  file_path:   f.file_path,
  file_size:   f.file_size ?? null,
  uploaded_at: f.uploaded_at || null,
});

/* Adds p.files to every proposal (best effort, never throws).
   A proposal with no rows yet but an old file_path shows that file as its main document. */
const attachFiles = async (proposals) => {
  const list = proposals || [];
  const legacy = (p) => ({ file_id: null, kind: 'main', label: MAIN_LABEL, file_name: null, file_path: p.file_path, file_size: null, uploaded_at: null });
  const fallback = (p) => (p.file_path ? [legacy(p)] : []);
  if (!list.length) return list;
  try {
    const ids = list.map(p => p.proposal_id);
    const { data, error } = await supabase.from('proposal_files').select('*').in('proposal_id', ids);
    if (error) throw error;
    const by = {};
    (data || []).forEach(f => { (by[f.proposal_id] = by[f.proposal_id] || []).push(f); });
    list.forEach(p => {
      const rows = sortFiles(by[p.proposal_id]).map(publicFile);
      /* an older single file (file_path) with no row yet is shown as the main document */
      if (p.file_path && !rows.some(f => f.kind === 'main')) rows.unshift(legacy(p));
      p.files = rows;
    });
  } catch (err) {
    console.error('attachFiles failed:', err.message || err);
    list.forEach(p => { p.files = fallback(p); });
  }
  return list;
};

/* Applies a change of documents to a proposal:
     add      : rows from uploadAll (a new main replaces the old main)
     removeIds: ids of supporting documents to remove
   Checks the limits against what the proposal already has.
   Returns { ok, error?, files, mainPath, removedKeys }.                       */
const planChange = (current, { add = [], removeIds = [] }) => {
  const byId     = Object.fromEntries(current.map(f => [Number(f.file_id), f]));
  const bad      = removeIds.find(id => !byId[id]);
  if (bad) return { ok: false, error: 'One of the documents to remove does not belong to this proposal.' };
  if (removeIds.some(id => byId[id].kind === 'main')) {
    return { ok: false, error: 'The Main Proposal Document cannot be removed. Replace it with a new file instead.' };
  }
  const newMain   = add.find(a => a.kind === 'main');
  const oldMain   = current.find(f => f.kind === 'main');
  const replaced  = newMain && oldMain ? [oldMain] : [];
  const removed   = [...removeIds.map(id => byId[id]), ...replaced];
  const keep      = current.filter(f => !removed.includes(f));
  const supporting = keep.filter(f => f.kind === 'supporting').length + add.filter(a => a.kind === 'supporting').length;
  if (supporting > MAX_SUPPORTING) {
    return { ok: false, error: `A proposal can have at most ${MAX_SUPPORTING} supporting documents. Remove one first.` };
  }
  return { ok: true, removed, keep, newMain: newMain || null, hasMain: !!(newMain || keep.some(f => f.kind === 'main')) };
};

/* Saves the plan: deletes removed rows, inserts the new ones, keeps file_path in step.
   Storage objects of removed rows are deleted afterwards (best effort). */
const applyChange = async (proposalId, plan, add) => {
  if (plan.removed.length) {
    const { error } = await supabase.from('proposal_files').delete()
      .in('file_id', plan.removed.map(f => f.file_id));
    if (error) throw error;
  }
  if (add.length) {
    const { error } = await supabase.from('proposal_files')
      .insert(add.map(a => ({ ...a, proposal_id: Number(proposalId) })));
    if (error) throw error;
  }
  await removeKeys(plan.removed.map(f => f.storage_key || keyFromPath(f.file_path)));
};

/* Deletes every document of a proposal (rows and Storage objects). Best effort. */
const removeAllFiles = async (proposalId, extraPath = null) => {
  try {
    const rows = await listFiles(proposalId);
    const keys = rows.map(f => f.storage_key || keyFromPath(f.file_path));
    if (extraPath && !rows.some(f => f.file_path === extraPath)) keys.push(keyFromPath(extraPath));
    await supabase.from('proposal_files').delete().eq('proposal_id', proposalId);
    await removeKeys(keys);
  } catch (err) {
    console.error('removeAllFiles failed:', err.message || err);
  }
};

module.exports = {
  MAX_MB, MAX_SUPPORTING, MAX_FILES, LABEL_MAX, MAIN_LABEL, SUPPORTING_LABELS, ALLOWED_MIME,
  readUpload, readIds, uploadAll, listFiles, attachFiles, planChange, applyChange,
  removeKeys, removeAllFiles, publicFile, keyFromPath,
};