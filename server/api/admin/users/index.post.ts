// Admin menambah pengguna baru (dapat kategori bawaan sendiri)
export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const body = await readBody(event);
  const { username, password } = validateCredentials(body);
  const role: Role = body?.role === "admin" ? "admin" : "user";
  const hash = await hashPassword(password);
  try {
    const id = await withTransaction(async (tx) => {
      const r = await execute(
        "INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)",
        [username, hash, role, Date.now()], tx,
      );
      await seedUserCategories(r.insertId, tx);
      return r.insertId;
    });
    setResponseStatus(event, 201);
    return { id, username, role };
  } catch (e) {
    if (isDuplicateError(e)) throw httpError(409, "Username sudah dipakai");
    throw e;
  }
});
