import * as jose from "npm:jose@5";

const AUTH0_DOMAIN = Deno.env.get("AUTH0_DOMAIN")!;
const AUTH0_AUDIENCE = Deno.env.get("AUTH0_AUDIENCE")!;

const JWKS = jose.createRemoteJWKSet(
  new URL(`https://${AUTH0_DOMAIN}/.well-known/jwks.json`)
);

export type AuthResult = {
  valid: boolean;
  userId?: string;
  error?: string;
};

export async function verifyAuth0Token(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { valid: false, error: "Missing or malformed Authorization header" };
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    const { payload } = await jose.jwtVerify(token, JWKS, {
      issuer: `https://${AUTH0_DOMAIN}/`,
      audience: AUTH0_AUDIENCE,
    });

    return { valid: true, userId: payload.sub };
  } catch (err) {
    return { valid: false, error: String(err) };
  }
}