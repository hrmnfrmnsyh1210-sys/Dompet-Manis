export default defineEventHandler(async (event) => {
  const { userId } = await requireUserOrApi(event);
  const id = parseId(getRouterParam(event, "id"));
  const r = await execute("DELETE FROM transactions WHERE id = ? AND user_id = ?", [id, userId]);
  if (!r.rowsAffected) throw httpError(404, "Transaksi tidak ditemukan");
  return { ok: true };
});
