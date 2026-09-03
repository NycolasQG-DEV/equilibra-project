import jwt from "jsonwebtoken";
import { UserRole, PlanType } from "@/types/database";

const JWT_SECRET = process.env.JWT_SECRET || "equilibra_jwt_super_secret_production_key_2026_default";
const JWT_EXPIRES_IN = "30d";

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  name: string;
  plan: PlanType;
}

/**
 * Assina um JWT para o usuário autenticado
 */
export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Valida e decodifica um token JWT
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}
