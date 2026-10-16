// Autentikasi: hash password, sesi cookie, API key untuk bot, pembatas percobaan login
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { H3Event } from "h3";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const COOKIE_NAME = "dm_session";
const DAY = 24 * 60 * 60 * 1000;

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// ---------- Password ----------
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algo, saltHex, hashHex] = String(stored).split("$");
  if (algo !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(expected, actual);
}

export function validateCredentials(body: any) {
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");
  if (!/^[a-zA-Z0-9_.]{3,30}$/.test(username))
    throw httpError(400, "Username 3-30 karakter (huruf, angka, titik, garis bawah)");
  if (password.length < 8) throw httpError(400, "Password minimal 8 karakter");
  if (password.length > 200) throw httpError(400, "Password terlalu panjang");
  return { username, password };
}

// ---------- Sesi ----------
export async function createSession(event: H3Event, userId: number, remember: boolean) {
  const token = randomBytes(32).toString("base64url");
  const maxAge = remember ? 30 * DAY : DAY;
  await execute("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)", [sha256(token), userId, Date.now() + maxAge]);
  setCookie(event, COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: !import.meta.dev,
    maxAge: maxAge / 1000,
    path: "/",
  });
}

export async function destroySession(event: H3Event) {
  const token = getCookie(event, COOKIE_NAME);
  if (token) await execute("DELETE FROM sessions WHERE token_hash = ?", [sha256(token)]);
  deleteCookie(event, COOKIE_NAME, { path: "/" });
}

export async function destroyAllSessions(userId: number) {
  await execute("DELETE FROM sessions WHERE user_id = ?", [userId]);
}

export type Role = "admin" | "user";
export type SessionUser = { id: number; username: string; role: Role };

export async function getSessionUser(event: H3Event): Promise<SessionUser | null> {
  const token = getCookie(event, COOKIE_NAME);
  if (!token) return null;
  return queryOne<SessionUser>(
    `SELECT u.id, u.username, u.role FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
    [sha256(token), Date.now()],
  );
}

// ---------- API key per pengguna (untuk bot Telegram / LLM) ----------
export async function generateApiKey(userId: number) {
  const key = "dm_" + randomBytes(24).toString("base64url");
  await execute(
    `INSERT INTO api_keys (user_id, key_hash, created_at) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE key_hash = VALUES(key_hash), created_at = VALUES(created_at)`,
    [userId, sha256(key), Date.now()],
  );
  return key;
}

export async function revokeApiKey(userId: number) {
  await execute("DELETE FROM api_keys WHERE user_id = ?", [userId]);
}

export async function apiKeyStatus(userId: number) {
  const row = await queryOne<{ created_at: number }>("SELECT created_at FROM api_keys WHERE user_id = ?", [userId]);
  return { active: !!row, createdAt: row?.created_at ?? null };
}

/** Key dicari lewat hash-nya, jadi key sekaligus menentukan pemilik datanya */
async function userIdFromApiKey(event: H3Event): Promise<number | null> {
  const m = /^Bearer\s+(.+)$/i.exec(getHeader(event, "authorization") || "");
  if (!m) return null;
  const row = await queryOne<{ user_id: number }>("SELECT user_id FROM api_keys WHERE key_hash = ?", [sha256(m[1]!.trim())]);
  return row?.user_id ?? null;
}

// ---------- Penjaga endpoint ----------
/** Hanya untuk pengguna yang login lewat web */
export async function requireUser(event: H3Event) {
  const user = await getSessionUser(event);
  if (!user) throw httpError(401, "Silakan login terlebih dahulu");
  return user;
}

/** Hanya untuk admin */
export async function requireAdmin(event: H3Event) {
  const user = await requireUser(event);
  if (user.role !== "admin") throw httpError(403, "Khusus admin");
  return user;
}

/** Boleh lewat sesi web atau API key (bot). Mengembalikan pemilik data. */
export async function requireUserOrApi(event: H3Event): Promise<{ userId: number; via: "web" | "api" }> {
  // Jika header Authorization dikirim, key-nya wajib valid (tidak jatuh ke cookie)
  if (getHeader(event, "authorization")) {
    const userId = await userIdFromApiKey(event);
    if (userId) return { userId, via: "api" };
    throw httpError(401, "API key tidak valid");
  }
  const user = await getSessionUser(event);
  if (user) return { userId: user.id, via: "web" };
  throw httpError(401, "Silakan login terlebih dahulu");
}

// ---------- Pembatas percobaan login (disimpan di DB karena serverless) ----------
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export function clientIp(event: H3Event) {
  return (getRequestIP(event, { xForwardedFor: true }) || "unknown").slice(0, 64);
}

export async function loginBlockedMinutes(ip: string) {
  const a = await queryOne<{ count: number; first_at: number }>("SELECT count, first_at FROM login_attempts WHERE ip = ?", [ip]);
  if (!a || Date.now() - a.first_at > WINDOW_MS) return 0;
  return a.count >= MAX_ATTEMPTS ? Math.ceil((a.first_at + WINDOW_MS - Date.now()) / 60000) : 0;
}

export async function recordLoginFailure(ip: string) {
  const now = Date.now();
  await execute(
    `INSERT INTO login_attempts (ip, count, first_at) VALUES (?, 1, ?)
     ON DUPLICATE KEY UPDATE
       count = IF(first_at < ?, 1, count + 1),
       first_at = IF(first_at < ?, VALUES(first_at), first_at)`,
    [ip, now, now - WINDOW_MS, now - WINDOW_MS],
  );
}

export async function clearLoginFailures(ip: string) {
  await execute("DELETE FROM login_attempts WHERE ip = ?", [ip]);
}

export async function cleanupExpired() {
  await execute("DELETE FROM sessions WHERE expires_at <= ?", [Date.now()]);
  await execute("DELETE FROM login_attempts WHERE first_at < ?", [Date.now() - WINDOW_MS]);
}

// ---------- Pendaftaran mandiri ----------
/** Terbuka secara bawaan; admin bisa menutupnya di halaman Pengguna */
export async function registrationOpen() {
  return (await getSetting("registration_open")) !== "0";
}

// Memakai tabel login_attempts dengan kunci "reg:<ip>": maksimal 3 akun baru per IP per 15 menit
const MAX_REGISTRATIONS = 3;
const regKey = (ip: string) => `reg:${ip}`.slice(0, 64);

export async function registerBlockedMinutes(ip: string) {
  const a = await queryOne<{ count: number; first_at: number }>("SELECT count, first_at FROM login_attempts WHERE ip = ?", [regKey(ip)]);
  if (!a || Date.now() - a.first_at > WINDOW_MS) return 0;
  return a.count >= MAX_REGISTRATIONS ? Math.ceil((a.first_at + WINDOW_MS - Date.now()) / 60000) : 0;
}

export const recordRegistration = (ip: string) => recordLoginFailure(regKey(ip));
