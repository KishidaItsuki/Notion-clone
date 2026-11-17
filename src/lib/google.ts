import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { decodeJwt } from "jose";
import { API } from "./routes";

// 通常は変更不要（ローカルでの動作テスト時のみ上書きできるようにしている）
const AUTH_ENDPOINT = process.env.GOOGLE_AUTH_ENDPOINT || "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = process.env.GOOGLE_TOKEN_ENDPOINT || "https://oauth2.googleapis.com/token";

export const OAUTH_COOKIE = "nc_oauth";

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function redirectUri(base: string) {
  return `${base}${API.authGoogleCallback}`;
}

const b64url = (buf: Buffer) => buf.toString("base64url");

/** 認可リクエスト用の state / nonce / PKCE を作成 */
export function createAuthRequest(clientId: string, base: string) {
  const state = b64url(randomBytes(24));
  const nonce = b64url(randomBytes(24));
  const verifier = b64url(randomBytes(48));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const url = new URL(AUTH_ENDPOINT);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(base),
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return { url: url.toString(), cookie: JSON.stringify({ state, nonce, verifier }) };
}

export type GoogleProfile = { sub: string; email: string; name: string; picture: string | null };

/** 認可コードをトークンに交換し、ID トークンを検証してプロフィールを返す */
export async function exchangeCode(opts: {
  code: string;
  verifier: string;
  nonce: string;
  base: string;
  clientId: string;
  clientSecret: string;
}): Promise<GoogleProfile> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: opts.code,
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      redirect_uri: redirectUri(opts.base),
      grant_type: "authorization_code",
      code_verifier: opts.verifier,
    }),
  });
  if (!res.ok) throw new Error(`token endpoint returned ${res.status}`);
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) throw new Error("id_token がありません");

  // トークンエンドポイントから TLS で直接受け取った ID トークンなので、
  // 署名検証は省略し、発行者・宛先・有効期限・nonce を確認する（Google の推奨手順）
  const c = decodeJwt(id_token);
  if (c.iss !== "https://accounts.google.com" && c.iss !== "accounts.google.com") throw new Error("iss が不正です");
  if (c.aud !== opts.clientId) throw new Error("aud が不正です");
  if (!c.exp || c.exp * 1000 < Date.now()) throw new Error("ID トークンの期限切れ");
  if (c.nonce !== opts.nonce) throw new Error("nonce が一致しません");
  if (c.email_verified !== true || typeof c.email !== "string") throw new Error("メールアドレスが未確認です");

  const email = c.email.toLowerCase();
  return {
    sub: String(c.sub),
    email,
    name: typeof c.name === "string" && c.name ? c.name : email.split("@")[0],
    picture: typeof c.picture === "string" ? c.picture : null,
  };
}
