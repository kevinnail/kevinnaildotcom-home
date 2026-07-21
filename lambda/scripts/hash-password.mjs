// One-off helper: turn a plaintext admin password into the salted scrypt hash
// to paste into the Lambda's ADMIN_PASSWORD_HASH env var.
//
//   node lambda/scripts/hash-password.mjs 'your-password-here'
//
// The plaintext is never stored anywhere — only the printed hash is.

import { hashPassword } from '../lib.mjs';

const password = process.argv[2];
if (!password) {
  console.error("Usage: node lambda/scripts/hash-password.mjs '<password>'");
  process.exit(1);
}

console.log(hashPassword(password));
