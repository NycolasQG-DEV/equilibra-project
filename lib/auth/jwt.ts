import jwt from "jsonwebtoken";
import { UserRole, PlanType } from "@/types/database";
function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32)
    throw new Error(
      "Configure JWT_SECRET com pelo menos 32 caracteres aleatórios.",
    );
  return value;
}
export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  name: string;
  plan: PlanType;
}
export function signToken(payload: TokenPayload) {
  return jwt.sign(payload, secret(), { expiresIn: "7d", algorithm: "HS256" });
}
export function verifyToken(token: string): TokenPayload | null {
  try {
    const p = jwt.verify(token, secret(), { algorithms: ["HS256"] });
    if (typeof p !== "object" || typeof p.userId !== "string") return null;
    return p as TokenPayload;
  } catch {
    return null;
  }
}
