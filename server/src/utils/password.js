import crypto from 'crypto';
import { validatePasswordComplexity } from './validators.js';

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*';

const pick = (chars) => chars[crypto.randomInt(chars.length)];

// Builds a random password guaranteed to satisfy validatePasswordComplexity, for admin-created accounts.
export const generateTempPassword = () => {
  let password;
  do {
    const body = Array.from({ length: 8 }, () => pick(LETTERS)).join('');
    password = `${body}${pick(DIGITS)}${pick(SYMBOLS)}`;
  } while (!validatePasswordComplexity(password));
  return password;
};
