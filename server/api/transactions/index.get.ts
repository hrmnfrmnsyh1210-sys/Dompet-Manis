export default defineEventHandler(async (event) => {
  const { userId } = await requireUserOrApi(event);
  const q = getQuery(event);
  const where: string[] = ["t.user_id = ?"];
  const args: any[] = [userId];
  if (q.month) {
    if (!MONTH_RE.test(String(q.month))) throw httpError(400, "Format bulan harus YYYY-MM");
    where.push("LEFT(t.date, 7) = ?");
    args.push(String(q.month));
  }
  if (q.type) {
    if (!TYPES.includes(q.type as TrxType)) throw httpError(400, "Jenis tidak valid");
    where.push("t.type = ?");
    args.push(String(q.type));
  }
  const limit = Math.min(Math.max(Number(q.limit) || 500, 1), 5000);
  return query(
    `${TRX_SELECT} WHERE ${where.join(" AND ")}
     ORDER BY t.date DESC, t.created_at DESC, t.id DESC LIMIT ${limit}`,
    args,
  );
});
