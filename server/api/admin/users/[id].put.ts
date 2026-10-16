// Admin mengubah peran dan/atau mereset password pengguna
export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const id = parseId(getRouterParam(event, "id"));
  const body = (await readBody(event)) ?? {};
  const target = await queryOne<{ id: number; username: string; role: Role }>("SELECT id, username, role FROM users WHERE id = ?", [id]);
  if (!target) throw httpError(404, "Pengguna tidak ditemukan");

  if (body.role != null) {
    if (body.role !== "admin" && body.role !== "user") throw httpError(400, "Peran tidak valid");
    if (target.role === "admin" && body.role === "user") {
      const { n } = (await queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'"))!;
      if (n <= 1) throw httpError(400, "Harus ada minimal 1 admin");
    }
    await execute("UPDATE users SET role = ? WHERE id = ?", [body.role, id]);
  }

  if (body.password != null) {
    const { password } = validateCredentials({ username: target.username, password: body.password });
    await execute("UPDATE users SET password_hash = ? WHERE id = ?", [await hashPassword(password), id]);
    // Paksa pengguna login ulang dengan password baru
    await destroyAllSessions(id);
  }

  return { ok: true };
});
