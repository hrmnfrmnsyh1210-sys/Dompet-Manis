// Daftar pengguna + ringkasan keuangan masing-masing (angka total saja, bukan rincian transaksi)
export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const month = String(getQuery(event).month || todayISO().slice(0, 7));
  if (!MONTH_RE.test(month)) throw httpError(400, "Format bulan harus YYYY-MM");

  const rows = await query<{
    id: number; username: string; role: Role; created_at: number;
    tin: number; tout: number; m_in: number; m_out: number; n: number; last_at: number | null; saldo_awal: string | null;
  }>(`
    SELECT u.id, u.username, u.role, u.created_at,
      COALESCE(SUM(CASE WHEN t.type = 'in' THEN t.amount END), 0) AS tin,
      COALESCE(SUM(CASE WHEN t.type = 'out' THEN t.amount END), 0) AS tout,
      COALESCE(SUM(CASE WHEN t.type = 'in' AND LEFT(t.date, 7) = ? THEN t.amount END), 0) AS m_in,
      COALESCE(SUM(CASE WHEN t.type = 'out' AND LEFT(t.date, 7) = ? THEN t.amount END), 0) AS m_out,
      COUNT(t.id) AS n,
      MAX(t.created_at) AS last_at,
      MAX(us.v) AS saldo_awal
    FROM users u
    LEFT JOIN transactions t ON t.user_id = u.id
    LEFT JOIN user_settings us ON us.user_id = u.id AND us.k = 'saldo_awal'
    GROUP BY u.id, u.username, u.role, u.created_at
    ORDER BY u.id`, [month, month]);

  return {
    month,
    users: rows.map((r) => {
      const saldoAwal = Number(r.saldo_awal ?? 0);
      return {
        id: r.id,
        username: r.username,
        role: r.role,
        createdAt: r.created_at,
        lastActivity: r.last_at,
        count: r.n,
        saldoAwal,
        saldo: saldoAwal + r.tin - r.tout,
        totalIn: r.tin,
        totalOut: r.tout,
        monthIn: r.m_in,
        monthOut: r.m_out,
      };
    }),
  };
});
