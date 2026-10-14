import { createHash, randomBytes } from "node:crypto";

/** El token crudo viaja en el enlace; en la base solo se guarda su sha256. */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function generateInvitationToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}
