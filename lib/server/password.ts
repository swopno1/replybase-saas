import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  const [algorithm, salt, storedHash] = encodedHash.split(":");

  if (!algorithm || !salt || !storedHash || algorithm !== "scrypt") {
    return false;
  }

  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  const storedBuffer = Buffer.from(storedHash, "hex");

  if (storedBuffer.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(storedBuffer, derivedKey);
}
