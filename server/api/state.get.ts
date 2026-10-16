// Semua data dashboard milik pengguna yang login
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const [saldoAwal, categories, transactions] = await Promise.all([
    saldoAwalOf(user.id),
    listCategories(user.id),
    query(
      "SELECT id, type, date, category_id, amount, note, source, created_at FROM transactions WHERE user_id = ? ORDER BY date, created_at, id",
      [user.id],
    ),
  ]);
  return { username: user.username, role: user.role, saldoAwal, categories, transactions };
});
