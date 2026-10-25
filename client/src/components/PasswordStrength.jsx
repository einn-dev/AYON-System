import React from 'react';
import './PasswordPages.css';

export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 72;     // the server only reads the first 72 characters

/* 0 = nothing typed, 1 = Weak, 2 = Fair, 3 = Good, 4 = Strong.
   This is only a hint for the person. The real rule is the length (8 to 72). */
export const passwordScore = (p) => {
  if (!p) return 0;
  if (p.length < MIN_PASSWORD) return 1;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(p)).length;
  let s = 2;
  if (p.length >= 12) s += 1;
  if (kinds >= 3)     s += 1;
  return Math.min(4, s);
};

const LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];

/* the coloured bar under a "new password" box */
export const PasswordStrength = ({ value }) => {
  const s = passwordScore(value);
  if (!s) return null;
  return (
    <div className="pw-strength" aria-live="polite">
      <div className="pw-meter" data-s={s}><i /><i /><i /><i /></div>
      <span className="pw-meter-label">{LABELS[s]}</span>
    </div>
  );
};

/* "At least 8 characters" / "Both passwords match" checklist */
export const PasswordRules = ({ value, confirm }) => (
  <ul className="pw-rules">
    <li className={value.length >= MIN_PASSWORD ? 'pass' : ''}>At least {MIN_PASSWORD} characters</li>
    <li className={value && value === confirm ? 'pass' : ''}>Both passwords match</li>
  </ul>
);

/* the checks the server will repeat; returns a message or '' */
export const checkNewPassword = (pw, confirm, current) => {
  if (pw.length < MIN_PASSWORD) return `New password must be at least ${MIN_PASSWORD} characters.`;
  if (pw.length > MAX_PASSWORD) return `New password must be ${MAX_PASSWORD} characters or fewer.`;
  if (current !== undefined && pw === current) return 'Your new password must be different from the current one.';
  if (pw !== confirm) return 'The two passwords do not match.';
  return '';
};