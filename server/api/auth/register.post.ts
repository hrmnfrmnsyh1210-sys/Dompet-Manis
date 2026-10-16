// Pendaftaran mandiri: siapa pun bisa membuat akun (peran pengguna biasa) selama admin membukanya.
// Dibatasi per IP supaya tidak dipakai membuat akun massal.
export default defineEventHandler(async (event) => {
  const { n } = (await queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM users"))!;
  if (n === 0) throw httpError(409, "Belum ada akun. Buat akun admin pertama dulu");
  if (!(await registrationOpen())) throw httpError(403, "Pendaftaran sedang ditutup oleh admin");

  const ip = clientIp(event);
  const wait = await registerBlockedMinutes(ip);
  if (wait) throw httpError(429, `Terlalu banyak pendaftaran dari jaringan ini. Coba lagi dalam ${wait} menit`);

  const { username, password } = validateCredentials(await readBody(event));
  const hash = await hashPassword(password);
  let id: number;
  try {
    id = await withTransaction(async (tx) => {
      const r = await execute(
        "INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, 'user', ?)",
        [username, hash, Date.now()], tx,
      );
      await seedUserCategories(r.insertId, tx);
      return r.insertId;
    });
  } catch (e) {
    if (isDuplicateError(e)) throw httpError(409, "Username sudah dipakai, coba yang lain");
    throw e;
  }
  await recordRegistration(ip);
  await createSession(event, id, false);
  setResponseStatus(event, 201);
  return { ok: true };
});
