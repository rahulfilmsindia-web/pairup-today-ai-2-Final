import crypto from 'crypto';

const LEGACY_SALT = '_pairup_salt_2026';
const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const derivedKey = await deriveKey(password, salt, SCRYPT_COST, SCRYPT_BLOCK_SIZE, SCRYPT_PARALLELIZATION);
  return [
    'scrypt',
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELIZATION,
    salt.toString('base64url'),
    derivedKey.toString('base64url')
  ].join('$');
}

export async function verifyPassword(password: string, storedHash: string): Promise<{ valid: boolean; upgradedHash?: string }> {
  if (storedHash.startsWith('scrypt$')) {
    const [algorithm, costText, blockSizeText, parallelizationText, saltText, keyText, extra] = storedHash.split('$');
    const cost = Number(costText);
    const blockSize = Number(blockSizeText);
    const parallelization = Number(parallelizationText);
    if (
      algorithm !== 'scrypt' ||
      extra !== undefined ||
      !Number.isSafeInteger(cost) || cost < 2 || cost > 1048576 || (cost & (cost - 1)) !== 0 ||
      !Number.isSafeInteger(blockSize) || blockSize < 1 || blockSize > 32 ||
      cost * blockSize > 1048576 ||
      !Number.isSafeInteger(parallelization) || parallelization < 1 || parallelization > 16 ||
      !saltText || !keyText
    ) {
      return { valid: false };
    }

    const salt = Buffer.from(saltText, 'base64url');
    const expectedKey = Buffer.from(keyText, 'base64url');
    if (salt.length < 16 || salt.length > 64 || expectedKey.length !== KEY_LENGTH) {
      return { valid: false };
    }

    const actualKey = await deriveKey(password, salt, cost, blockSize, parallelization);
    return { valid: crypto.timingSafeEqual(actualKey, expectedKey) };
  }

  if (!/^[a-f0-9]{64}$/i.test(storedHash)) {
    return { valid: false };
  }
  const expectedLegacyHash = Buffer.from(storedHash, 'hex');
  const actualLegacyHash = crypto.createHash('sha256').update(password + LEGACY_SALT).digest();
  if (!crypto.timingSafeEqual(actualLegacyHash, expectedLegacyHash)) {
    return { valid: false };
  }
  return { valid: true, upgradedHash: await hashPassword(password) };
}

function deriveKey(
  password: string,
  salt: Buffer,
  cost: number,
  blockSize: number,
  parallelization: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      KEY_LENGTH,
      { N: cost, r: blockSize, p: parallelization, maxmem: 128 * 1024 * 1024 },
      (error, derivedKey) => error ? reject(error) : resolve(derivedKey)
    );
  });
}
