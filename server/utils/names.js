/* ─────────────────────────────────────────────────────────────
   How a person's name is written in AYON.
     personName(u)   "Maria C. Santos"     (lists, notices, signatures, emails)
     fullLegalName(u) "Maria Cruz Santos"  (the Administrator's User Accounts)
   A person without a middle name is simply "Maria Santos".
   ───────────────────────────────────────────────────────────── */

const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

/* "Cruz" -> "C."   "dela Cruz" -> "D." */
const middleInitial = (m) => {
  const s = clean(m);
  return s ? `${s[0].toUpperCase()}.` : '';
};

const personName = (u) =>
  [clean(u?.first_name), middleInitial(u?.middle_name), clean(u?.last_name)].filter(Boolean).join(' ');

const fullLegalName = (u) =>
  [clean(u?.first_name), clean(u?.middle_name), clean(u?.last_name)].filter(Boolean).join(' ');

module.exports = { personName, fullLegalName, middleInitial };