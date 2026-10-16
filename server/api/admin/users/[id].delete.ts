// Admin menghapus pengguna beserta seluruh datanya
export default defineEventHandler(async (event) => {
  const me = await requireAdmin(event);
  const id = parseId(getRouterParam(event, "id"));
  if (id === me.id) throw httpError(400, "Tidak bisa menghapus akunmu sendiri");
  if (!(await queryOne("SELECT id FROM users WHERE id = ?", [id]))) throw httpError(404, "Pengguna tidak ditemukan");

  await withTransaction(async (tx) => {
    for (const table of ["transactions", "categories", "user_settings", "api_keys", "sessions"])
      await execute(`DELETE FROM ${table} WHERE user_id = ?`, [id], tx);
    await execute("DELETE FROM users WHERE id = ?", [id], tx);
  });
  return { ok: true };
});
