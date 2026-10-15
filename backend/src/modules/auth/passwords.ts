import { argon2id, hash, verify } from "argon2";

const options = {
  type: argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

let dummy: Promise<string> | undefined;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, options);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

export async function dummyPasswordHash(): Promise<string> {
  dummy ??= hash(crypto.randomUUID(), options);
  return dummy;
}
