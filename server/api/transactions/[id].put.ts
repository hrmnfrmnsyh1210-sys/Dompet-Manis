// Edit transaksi. Field yang tidak dikirim tetap memakai nilai lama.
export default defineEventHandler(async (event) => {
  const { userId } = await requireUserOrApi(event);
  const id = parseId(getRouterParam(event, "id"));
  const body = (await readBody(event)) ?? {};
  const old = await queryOne("SELECT * FROM transactions WHERE id = ? AND user_id = ?", [id, userId]);
  if (!old) throw httpError(404, "Transaksi tidak ditemukan");

  const merged: any = { ...old, ...body };
  if (body.category != null && body.category_id == null) delete merged.category_id;
  if (body.type && body.type !== old.type && body.category == null && body.category_id == null)
    throw httpError(400, "Ganti jenis transaksi harus disertai kategori baru");

  const t = await validateTrx(userId, merged);
  await execute(
    "UPDATE transactions SET type = ?, date = ?, category_id = ?, amount = ?, note = ? WHERE id = ? AND user_id = ?",
    [t.type, t.date, t.category_id, t.amount, t.note, id, userId],
  );
  return { transaction: await getTrx(userId, id) };
});
