// Pembuatan akun pertama (otomatis admin) — hanya bisa sekali, saat belum ada akun sama sekali.
// Pengguna berikutnya dibuat oleh admin di halaman Pengguna.
export default defineEventHandler(async (event) => {
  const { username, password } = validateCredentials(await readBody(event));
  const hash = await hashPassword(password);
  const id = await withTransaction(async (tx) => {
    const { n } = (await queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM users", [], tx))!;
    if (n > 0) throw httpError(403, "Akun sudah dibuat, silakan login");
    // Kunci atomik: baris ini hanya bisa dibuat sekali, jadi dua permintaan bersamaan tidak bisa sama-sama lolos
    try {
      await execute("INSERT INTO settings (k, v) VALUES ('setup_done', '1')", [], tx);
    } catch (e) {
      if (isDuplicateError(e)) throw httpError(403, "Akun sudah dibuat, silakan login");
      throw e;
    }
    const r = await execute(
      "INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, 'admin', ?)",
      [username, hash, Date.now()], tx,
    );
    await seedUserCategories(r.insertId, tx);
    return r.insertId;
  });
  await createSession(event, id, false);
  return { ok: true };
});
