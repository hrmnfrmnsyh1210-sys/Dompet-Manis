export default defineEventHandler(async (event) => {
  const ip = clientIp(event);
  const wait = await loginBlockedMinutes(ip);
  if (wait) throw httpError(429, `Terlalu banyak percobaan. Coba lagi dalam ${wait} menit`);

  const body = await readBody(event);
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");
  const user = await queryOne<{ id: number; password_hash: string }>("SELECT id, password_hash FROM users WHERE username = ?", [username]);
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    await recordLoginFailure(ip);
    throw httpError(401, "Username atau password salah");
  }
  await clearLoginFailures(ip);
  await createSession(event, user.id, !!body?.remember);
  // Bersihkan sesi kedaluwarsa sesekali
  if (Math.random() < 0.2) await cleanupExpired().catch(() => {});
  return { ok: true };
});
