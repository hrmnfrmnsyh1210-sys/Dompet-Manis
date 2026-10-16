export default defineEventHandler(async (event) => {
  const me = await requireUser(event);
  const body = await readBody(event);
  const user = (await queryOne<{ username: string; password_hash: string }>("SELECT username, password_hash FROM users WHERE id = ?", [me.id]))!;
  if (!(await verifyPassword(String(body?.current ?? ""), user.password_hash))) throw httpError(400, "Password lama salah");
  const { password } = validateCredentials({ username: user.username, password: body?.next });
  await execute("UPDATE users SET password_hash = ? WHERE id = ?", [await hashPassword(password), me.id]);
  // Keluarkan semua perangkat lain, lalu buat sesi baru untuk perangkat ini
  await destroyAllSessions(me.id);
  await createSession(event, me.id, false);
  return { ok: true };
});
