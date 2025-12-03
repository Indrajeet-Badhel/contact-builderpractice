import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

function getKey(salt: Buffer): Buffer {
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }
  
  return crypto.pbkdf2Sync(
    process.env.ENCRYPTION_KEY,
    salt,
    100000,
    KEY_LENGTH,
    'sha512'
  );
}

export function encrypt(plaintext: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getKey(salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(plaintext), 'utf8'),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
}

export function decrypt(ciphertext: string): string {
  if (!ciphertext) return "";

  // If it's clearly not base64 (contains spaces, too short, etc.),
  // assume it's a legacy plain-text key.
  // But the main robust check is on the decoded buffer length.
  let stringValue: Buffer;
  try {
    stringValue = Buffer.from(String(ciphertext), "base64");
  } catch {
    // Not valid base64 → old plain value
    return ciphertext;
  }

  // Minimum length must fit: salt + iv + tag + at least 1 byte of encrypted data
  const minimumLength = SALT_LENGTH + IV_LENGTH + TAG_LENGTH + 1;
  if (stringValue.length < minimumLength) {
    // This is almost certainly a legacy plain-text key
    return ciphertext;
  }

  try {
    const salt = stringValue.subarray(0, SALT_LENGTH);
    const iv = stringValue.subarray(SALT_LENGTH, TAG_POSITION);
    const tag = stringValue.subarray(TAG_POSITION, ENCRYPTED_POSITION);
    const encrypted = stringValue.subarray(ENCRYPTED_POSITION);

    // Extra safety: IV must match what we used in encrypt()
    if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
      // Not our format → treat as plain text
      return ciphertext;
    }

    const key = getKey(salt);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch (err) {
    // If anything fails (wrong format, wrong key, etc.), fall back gracefully
    console.warn("Decrypt failed, returning raw ciphertext (likely legacy value):", err);
    return ciphertext;
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, hashedPassword: string): boolean {
  const [salt, hash] = hashedPassword.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}