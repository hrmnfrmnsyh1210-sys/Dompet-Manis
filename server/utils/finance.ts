// Logika bersama: validasi, kategori, ringkasan saldo
export type TrxType = "in" | "out";
export const TYPES: TrxType[] = ["in", "out"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MONTH_RE = /^\d{4}-\d{2}$/;

export function httpError(statusCode: number, message: string, data?: Record<string, unknown>) {
  return createError({ statusCode, statusMessage: message, message, data });
}

/** Tanggal hari ini sesuai zona waktu aplikasi (Vercel berjalan dalam UTC) */
export function todayISO() {
  const tz = useRuntimeConfig().appTimezone || "Asia/Jakarta";
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function isValidDate(s: unknown): s is string {
  if (typeof s !== "string" || !DATE_RE.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function toAmount(v: unknown) {
  const n = typeof v === "string" ? Number(v.replace(/[^\d]/g, "")) : Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > 1e13) throw httpError(400, "Jumlah harus angka lebih dari 0");
  return Math.round(n);
}

export function parseId(v: unknown) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw httpError(400, "ID tidak valid");
  return n;
}

// ---------- Kategori (semua fungsi dibatasi pada satu pengguna) ----------
export type Category = { id: number; user_id: number; type: TrxType; name: string; icon: string; sort: number; used?: number };

export function listCategories(userId: number) {
  return query<Category>(`
    SELECT c.id, c.type, c.name, c.icon, c.sort, COUNT(t.id) AS used
    FROM categories c LEFT JOIN transactions t ON t.category_id = c.id AND t.user_id = c.user_id
    WHERE c.user_id = ?
    GROUP BY c.id, c.type, c.name, c.icon, c.sort
    ORDER BY c.type, c.sort, c.id`, [userId]);
}

export function getCategory(userId: number, id: number) {
  return queryOne<Category>("SELECT * FROM categories WHERE id = ? AND user_id = ?", [id, userId]);
}

/** Kategori bisa dikirim lewat category_id atau nama (memudahkan bot/LLM) */
export async function resolveCategory(userId: number, type: TrxType, body: any) {
  let cat: Category | null = null;
  if (body.category_id != null && body.category_id !== "") {
    cat = await getCategory(userId, Number(body.category_id));
  } else if (typeof body.category === "string" && body.category.trim()) {
    cat = await queryOne<Category>("SELECT * FROM categories WHERE user_id = ? AND type = ? AND name = ?", [userId, type, body.category.trim()]);
  }
  if (!cat || cat.type !== type) {
    const rows = await query<{ name: string }>("SELECT name FROM categories WHERE user_id = ? AND type = ? ORDER BY sort, id", [userId, type]);
    throw httpError(400, "Kategori tidak ditemukan", { available: rows.map((r) => r.name) });
  }
  return cat;
}

export function validateCategory(body: any) {
  const name = String(body?.name ?? "").trim();
  const icon = String(body?.icon ?? DEFAULT_ICON).trim();
  if (!name || name.length > 40) throw httpError(400, "Nama kategori 1-40 karakter");
  if (!isIconKey(icon)) throw httpError(400, "Ikon tidak dikenal", { available: ICON_KEYS });
  return { name, icon };
}

export function isDuplicateError(e: unknown) {
  return /duplicate|1062/i.test(String((e as any)?.message ?? e));
}

// ---------- Transaksi ----------
export async function validateTrx(userId: number, input: any) {
  if (!TYPES.includes(input.type)) throw httpError(400, "Jenis harus 'in' (pemasukan) atau 'out' (pengeluaran)");
  const date = input.date || todayISO();
  if (!isValidDate(date)) throw httpError(400, "Format tanggal harus YYYY-MM-DD");
  const cat = await resolveCategory(userId, input.type, input);
  const note = String(input.note ?? "").trim().slice(0, 200);
  return { type: input.type as TrxType, date, category_id: cat.id, amount: toAmount(input.amount), note };
}

export const TRX_SELECT = `
  SELECT t.id, t.type, t.date, t.category_id, t.amount, t.note, t.source, t.created_at,
         c.name AS category, c.icon AS category_icon
  FROM transactions t JOIN categories c ON c.id = t.category_id`;

export function getTrx(userId: number, id: number) {
  return queryOne(`${TRX_SELECT} WHERE t.id = ? AND t.user_id = ?`, [id, userId]);
}

// ---------- Ringkasan ----------
type Sums = { tin: number; tout: number; n: number };
const SUM_SQL = `
  SELECT COALESCE(SUM(CASE WHEN type = 'in' THEN amount END), 0) AS tin,
         COALESCE(SUM(CASE WHEN type = 'out' THEN amount END), 0) AS tout,
         COUNT(*) AS n
  FROM transactions WHERE user_id = ?`;

export async function saldoAwalOf(userId: number) {
  return Number((await getUserSetting(userId, "saldo_awal")) ?? 0);
}

export async function summary(userId: number, month?: string) {
  const saldoAwal = await saldoAwalOf(userId);
  const all = (await queryOne<Sums>(SUM_SQL, [userId]))!;
  const result: Record<string, any> = {
    saldoAwal,
    saldoSekarang: saldoAwal + all.tin - all.tout,
    totalIn: all.tin,
    totalOut: all.tout,
    count: all.n,
  };
  if (month) {
    const before = (await queryOne<Sums>(`${SUM_SQL} AND LEFT(date, 7) < ?`, [userId, month]))!;
    const inMonth = (await queryOne<Sums>(`${SUM_SQL} AND LEFT(date, 7) = ?`, [userId, month]))!;
    const opening = saldoAwal + before.tin - before.tout;
    result.month = {
      month,
      saldoAwal: opening,
      totalIn: inMonth.tin,
      totalOut: inMonth.tout,
      saldoAkhir: opening + inMonth.tin - inMonth.tout,
      count: inMonth.n,
    };
  }
  return result;
}
