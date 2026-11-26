import React from 'react';
import './PasswordPages.css';

export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 72;     // the server only reads the first 72 characters

/* The checks every new password must pass (the server checks the same:
   server/utils/passwordRule.js). The others only make it stronger. */
export const REQUIRED_CHECKS = ['length', 'upper', 'number'];

/* What makes a password strong, checked while the person types
   (Register, Reset Password, Change Password, Add User). */
export const PASSWORD_CHECKS = [
  { k: 'length', label: `At least ${MIN_PASSWORD} characters`, test: (p) => p.length >= MIN_PASSWORD },
  { k: 'upper',  label: 'An uppercase letter (A–Z)',           test: (p) => /[A-Z]/.test(p) },
  { k: 'lower',  label: 'A lowercase letter (a–z)',            test: (p) => /[a-z]/.test(p) },
  { k: 'number', label: 'A number (0–9)',                      test: (p) => /\d/.test(p) },
  { k: 'symbol', label: 'A symbol (! @ # $ …)',                test: (p) => /[^A-Za-z0-9]/.test(p) },
];

/* 0 = nothing typed, 1 = Weak, 2 = Fair, 3 = Good, 4 = Strong.
   Shorter than 8 characters is always Weak; then each kind of character
   (uppercase, lowercase, number, symbol) beyond the first raises it one step. */
export const passwordScore = (p) => {
  if (!p) return 0;
  if (p.length < MIN_PASSWORD) return 1;
  const kinds = PASSWORD_CHECKS.slice(1).filter((c) => c.test(p)).length;
  return Math.max(1, Math.min(4, kinds));
};

export const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const LABELS = STRENGTH_LABELS;

/* What a password still needs, as one short line beside the strength:
   "needs 8+ characters, 1 uppercase, 1 number" ('' when it has everything required). */
const NEEDS = { length: `${MIN_PASSWORD}+ characters`, upper: '1 uppercase', number: '1 number' };
export const passwordNeeds = (p) => {
  const missing = PASSWORD_CHECKS.filter((c) => REQUIRED_CHECKS.includes(c.k) && !c.test(p || '')).map((c) => NEEDS[c.k]);
  return missing.length ? `needs ${missing.join(', ')}` : '';
};

/* the coloured bar under a "new password" box, with what is still missing beside it */
export const PasswordStrength = ({ value }) => {
  const s = passwordScore(value);
  if (!s) return null;
  const needs = passwordNeeds(value);
  return (
    <div className="pw-strength" aria-live="polite">
      <div className="pw-meter" data-s={s}><i /><i /><i /><i /></div>
      <span className="pw-meter-label">{LABELS[s]}{needs && <span className="pw-needs"> · {needs}</span>}</span>
    </div>
  );
};

/* "Both passwords match" (the length is in the checklist under the new password) */
export const PasswordRules = ({ value, confirm }) => (
  <ul className="pw-rules">
    <li className={value && value === confirm ? 'pass' : ''}>Both passwords match</li>
  </ul>
);

/* the checks the server will repeat; returns a message or '' */
export const checkNewPassword = (pw, confirm, current) => {
  if (pw.length < MIN_PASSWORD) return `New password must be at least ${MIN_PASSWORD} characters.`;
  if (pw.length > MAX_PASSWORD) return `New password must be ${MAX_PASSWORD} characters or fewer.`;
  if (!/[A-Z]/.test(pw) || !/\d/.test(pw)) return 'New password must contain at least one uppercase letter and one number.';
  if (current !== undefined && pw === current) return 'Your new password must be different from the current one.';
  if (pw !== confirm) return 'The two passwords do not match.';
  return '';
};