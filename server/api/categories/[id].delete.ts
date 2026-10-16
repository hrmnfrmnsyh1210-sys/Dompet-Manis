// Hapus kategori. Jika sudah dipakai, wajib kirim ?moveTo=<id> untuk memindahkan transaksinya.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const id = parseId(getRouterParam(event, "id"));
  const cat = await getCategory(user.id, id);
  if (!cat) throw httpError(404, "Kategori tidak ditemukan");
  const { n } = (await queryOne<{ n: number }>(
    "SELECT COUNT(*) AS n FROM categories WHERE user_id = ? AND type = ?",
    [user.id, cat.type],
  ))!;
  if (n <= 1) throw httpError(400, "Minimal harus ada 1 kategori untuk setiap jenis");

  const moveTo = Number(getQuery(event).moveTo) || 0;
  const moved = await withTransaction(async (tx) => {
    const { used } = (await queryOne<{ used: number }>(
      "SELECT COUNT(*) AS used FROM transactions WHERE user_id = ? AND category_id = ?",
      [user.id, id], tx,
    ))!;
    if (used > 0) {
      const target = await queryOne<Category>("SELECT * FROM categories WHERE id = ? AND user_id = ?", [moveTo, user.id], tx);
      if (!target || target.type !== cat.type || target.id === id)
        throw httpError(409, `Kategori dipakai ${used} transaksi. Pilih kategori pengganti.`, { used });
      await execute("UPDATE transactions SET category_id = ? WHERE user_id = ? AND category_id = ?", [target.id, user.id, id], tx);
    }
    await execute("DELETE FROM categories WHERE id = ? AND user_id = ?", [id, user.id], tx);
    return used;
  });
  return { ok: true, moved };
});
