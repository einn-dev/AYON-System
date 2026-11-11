/* ─────────────────────────────────────────────────────────────
   How a person's name is written in AYON (same rule as the server).
     personName(u)    "Maria C. Santos"     everywhere
     fullLegalName(u) "Maria Cruz Santos"   the Administrator's User Accounts
   Without a middle name it is simply "Maria Santos".
   ───────────────────────────────────────────────────────────── */

const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

export const middleInitial = (m) => {
  const s = clean(m);
  return s ? `${s[0].toUpperCase()}.` : '';
};

export const personName = (u) =>
  [clean(u?.first_name), middleInitial(u?.middle_name), clean(u?.last_name)].filter(Boolean).join(' ');

export const fullLegalName = (u) =>
  [clean(u?.first_name), clean(u?.middle_name), clean(u?.last_name)].filter(Boolean).join(' ');