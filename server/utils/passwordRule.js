/* The ONE password rule of AYON, used by Register, Reset Password, Change Password
   and the Administrator's Add User. The browser shows the same rule as a checklist
   (client/src/components/PasswordStrength.jsx).
     - 8 to 72 characters (bcrypt only reads the first 72)
     - at least one uppercase letter and one number
   Lowercase letters and symbols make a password stronger but are not required. */
const MIN_LENGTH = 8;
const MAX_LENGTH = 72;

/* a message when the password is not acceptable, otherwise null.
   word: how the message names it ("Password", "New password") */
const passwordProblem = (pw, word = 'Password') => {
  if (typeof pw !== 'string' || pw.length < MIN_LENGTH) return `${word} must be at least ${MIN_LENGTH} characters.`;
  if (pw.length > MAX_LENGTH) return `${word} must be ${MAX_LENGTH} characters or fewer.`;
  if (!/[A-Z]/.test(pw) || !/\d/.test(pw)) return `${word} must contain at least one uppercase letter and one number.`;
  return null;
};

module.exports = { MIN_LENGTH, MAX_LENGTH, passwordProblem };