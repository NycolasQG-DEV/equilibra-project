import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

/**
 * Gera o hash seguro de uma senha com salt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compara uma senha em texto puro com seu hash
 */
export async function comparePassword(password: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}
