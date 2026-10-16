// Koneksi TiDB Cloud lewat driver serverless (HTTP) — cocok untuk Vercel
import { connect, type Connection, type FullResult, type Tx } from "@tidbcloud/serverless";

type Conn = Connection<{ url: string }>;
type Executor = Conn | Tx<{ url: string }>;

const toNumber = (v: string) => Number(v);
let conn: Conn | null = null;
let schemaReady: Promise<void> | null = null;

function getConn(): Conn {
  if (!conn) {
    const url = useRuntimeConfig().databaseUrl || process.env.DATABASE_URL;
    if (!url) throw createError({ statusCode: 500, message: "DATABASE_URL belum diatur" });
    conn = connect({
      url,
      decoders: { BIGINT: toNumber, "UNSIGNED BIGINT": toNumber, DECIMAL: toNumber } as any,
    }) as Conn;
  }
  return conn;
}

/** SELECT → array baris */
export async function query<T = Record<string, any>>(sql: string, args: any[] = [], ex?: Executor): Promise<T[]> {
  await ensureSchema();
  return (await (ex ?? getConn()).execute(sql, args)) as T[];
}

/** Ambil satu baris (atau null) */
export async function queryOne<T = Record<string, any>>(sql: string, args: any[] = [], ex?: Executor): Promise<T | null> {
  return (await query<T>(sql, args, ex))[0] ?? null;
}

/** INSERT/UPDATE/DELETE → jumlah baris & id baru */
export async function execute(sql: string, args: any[] = [], ex?: Executor) {
  await ensureSchema();
  const r = (await (ex ?? getConn()).execute(sql, args, { fullResult: true })) as FullResult;
  return { rowsAffected: r.rowsAffected ?? 0, insertId: r.lastInsertId ? Number(r.lastInsertId) : 0 };
}

/** Jalankan beberapa query dalam satu transaksi database */
export async function withTransaction<T>(fn: (tx: Tx<{ url: string }>) => Promise<T>): Promise<T> {
  await ensureSchema();
  const tx = await getConn().begin();
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (e) {
    await tx.rollback().catch(() => {});
    throw e;
  }
}

// ---------- Skema (dibuat & dimigrasi otomatis saat pertama kali dipakai) ----------
// v1: kategori memakai emoji
// v2: kategori memakai ikon (kolom "icon")
// v3: multi-pengguna — data dipisah per user_id, peran admin/user
const SCHEMA_VERSION = 3;

type Exec = (sql: string, args?: any[]) => Promise<any>;

const TABLES_V3 = [
  `CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(30) COLLATE utf8mb4_general_ci NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(10) NOT NULL DEFAULT 'user',
    created_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash CHAR(64) PRIMARY KEY,
    user_id BIGINT NOT NULL,
    expires_at BIGINT NOT NULL,
    INDEX idx_sessions_user (user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    k VARCHAR(64) PRIMARY KEY,
    v TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS user_settings (
    user_id BIGINT NOT NULL,
    k VARCHAR(64) NOT NULL,
    v TEXT,
    PRIMARY KEY (user_id, k)
  )`,
  `CREATE TABLE IF NOT EXISTS api_keys (
    user_id BIGINT PRIMARY KEY,
    key_hash CHAR(64) NOT NULL UNIQUE,
    created_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS login_attempts (
    ip VARCHAR(64) PRIMARY KEY,
    count INT NOT NULL,
    first_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS categories (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    type VARCHAR(3) NOT NULL,
    name VARCHAR(40) COLLATE utf8mb4_general_ci NOT NULL,
    icon VARCHAR(16) NOT NULL DEFAULT 'sparkles',
    sort INT NOT NULL DEFAULT 0,
    UNIQUE KEY uq_user_category (user_id, type, name)
  )`,
  `CREATE TABLE IF NOT EXISTS transactions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    type VARCHAR(3) NOT NULL,
    date CHAR(10) NOT NULL,
    category_id BIGINT NOT NULL,
    amount BIGINT NOT NULL,
    note VARCHAR(200) NOT NULL DEFAULT '',
    source VARCHAR(20) NOT NULL DEFAULT 'web',
    created_at BIGINT NOT NULL,
    INDEX idx_trx_user_date (user_id, date),
    INDEX idx_trx_category (category_id)
  )`,
];

export const DEFAULT_CATEGORIES: Record<"in" | "out", [string, IconKey][]> = {
  in: [
    ["Gaji", "briefcase"], ["Uang Saku", "wallet"], ["Bonus", "gift"], ["Jualan", "store"],
    ["Hadiah", "heart"], ["Investasi", "growth"], ["Lainnya", "sparkles"],
  ],
  out: [
    ["Makan & Minum", "food"], ["Skincare & Makeup", "lipstick"], ["Fashion", "dress"], ["Belanja", "bag"],
    ["Transportasi", "car"], ["Tagihan", "bill"], ["Hiburan", "film"], ["Kesehatan", "health"],
    ["Pendidikan", "book"], ["Sedekah", "charity"], ["Tabungan", "piggy"], ["Lainnya", "sparkles"],
  ],
};

// Pemetaan emoji lama (v1) → ikon
const EMOJI_TO_ICON: Record<string, IconKey> = {
  "💼": "briefcase", "💝": "wallet", "🎁": "gift", "🧁": "cake", "🎀": "bow", "🌱": "growth", "✨": "sparkles",
  "💰": "coin", "💵": "cash", "🪙": "coin", "🏦": "bank", "📈": "growth", "🍰": "food", "🍜": "bowl",
  "☕": "drink", "🧋": "drink", "🍓": "food", "💄": "lipstick", "🧴": "lipstick", "💅": "lipstick",
  "👗": "dress", "👠": "dress", "👜": "bag", "🛍️": "bag", "🚗": "car", "🛵": "scooter", "🚌": "bus",
  "⛽": "fuel", "🧾": "bill", "💡": "bulb", "📱": "phone", "🏠": "home", "🎬": "film", "🎮": "game",
  "🎤": "music", "✈️": "plane", "💊": "health", "🏥": "health", "📚": "book", "✏️": "school",
  "🤲": "charity", "🐷": "piggy", "🐱": "cat", "🐶": "dog", "🌸": "flower", "💐": "flower",
  "🎂": "cake", "💖": "heart",
};

async function hasColumn(run: Exec, table: string, column: string) {
  return ((await run(`SHOW COLUMNS FROM ${table} LIKE '${column}'`)) as any[]).length > 0;
}

async function hasIndex(run: Exec, table: string, index: string) {
  return ((await run(`SHOW INDEX FROM ${table} WHERE Key_name = '${index}'`)) as any[]).length > 0;
}

/** v1 → v2: kolom emoji diganti icon */
async function migrateV2(run: Exec) {
  if (!(await hasColumn(run, "categories", "emoji"))) return;
  await run("ALTER TABLE categories RENAME COLUMN emoji TO icon");
  await run("ALTER TABLE categories ALTER COLUMN icon SET DEFAULT 'sparkles'");
  const byName = new Map(Object.values(DEFAULT_CATEGORIES).flat().map(([n, i]) => [n.toLowerCase(), i]));
  const cats = (await run("SELECT id, name, icon FROM categories")) as any[];
  for (const cat of cats) {
    if (isIconKey(cat.icon)) continue;
    const icon = byName.get(String(cat.name).toLowerCase()) ?? EMOJI_TO_ICON[cat.icon] ?? DEFAULT_ICON;
    await run("UPDATE categories SET icon = ? WHERE id = ?", [icon, cat.id]);
  }
}

/** v2 → v3: multi-pengguna. Semua data lama menjadi milik pengguna pertama (admin). */
async function migrateV3(run: Exec) {
  for (const sql of TABLES_V3) await run(sql); // tabel baru: user_settings, api_keys

  if (!(await hasColumn(run, "users", "role")))
    await run("ALTER TABLE users ADD COLUMN role VARCHAR(10) NOT NULL DEFAULT 'user'");
  if (!(await hasColumn(run, "categories", "user_id")))
    await run("ALTER TABLE categories ADD COLUMN user_id BIGINT NOT NULL DEFAULT 0");
  if (!(await hasColumn(run, "transactions", "user_id")))
    await run("ALTER TABLE transactions ADD COLUMN user_id BIGINT NOT NULL DEFAULT 0");
  if (await hasIndex(run, "categories", "uq_category")) await run("ALTER TABLE categories DROP INDEX uq_category");
  if (!(await hasIndex(run, "categories", "uq_user_category")))
    await run("ALTER TABLE categories ADD UNIQUE INDEX uq_user_category (user_id, type, name)");
  if (!(await hasIndex(run, "transactions", "idx_trx_user_date")))
    await run("ALTER TABLE transactions ADD INDEX idx_trx_user_date (user_id, date)");

  const first = ((await run("SELECT id FROM users ORDER BY id LIMIT 1")) as any[])[0];
  if (!first) return; // belum ada pengguna: data yatim diambil alih saat akun pertama dibuat
  const uid = first.id;
  await run("UPDATE users SET role = 'admin' WHERE id = ?", [uid]);
  await run("UPDATE categories SET user_id = ? WHERE user_id = 0", [uid]);
  await run("UPDATE transactions SET user_id = ? WHERE user_id = 0", [uid]);

  // Pindahkan pengaturan global lama menjadi milik admin
  const old = (await run("SELECT k, v FROM settings WHERE k IN ('saldo_awal', 'api_key_hash', 'api_key_created')")) as any[];
  const get = (k: string) => old.find((r) => r.k === k)?.v ?? null;
  if (get("saldo_awal") != null)
    await run("INSERT IGNORE INTO user_settings (user_id, k, v) VALUES (?, 'saldo_awal', ?)", [uid, get("saldo_awal")]);
  if (get("api_key_hash"))
    await run("INSERT IGNORE INTO api_keys (user_id, key_hash, created_at) VALUES (?, ?, ?)", [uid, get("api_key_hash"), Number(get("api_key_created")) || Date.now()]);
  await run("DELETE FROM settings WHERE k IN ('saldo_awal', 'api_key_hash', 'api_key_created')");
}

async function migrate() {
  const c = getConn();
  const run: Exec = (sql, args) => c.execute(sql, args ?? null);
  let version = 0;
  try {
    const rows = (await run("SELECT v FROM settings WHERE k = 'schema_version'")) as any[];
    version = Number(rows[0]?.v ?? 0);
  } catch {
    // tabel belum ada → instalasi baru
  }
  if (version >= SCHEMA_VERSION) return;

  if (version === 0) {
    for (const sql of TABLES_V3) await run(sql);
  } else {
    if (version < 2) await migrateV2(run);
    if (version < 3) await migrateV3(run);
  }
  await run(
    "INSERT INTO settings (k, v) VALUES ('schema_version', ?) ON DUPLICATE KEY UPDATE v = VALUES(v)",
    [String(SCHEMA_VERSION)],
  );
}

export function ensureSchema() {
  if (!schemaReady) {
    schemaReady = migrate().catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}

/** Kategori bawaan untuk pengguna baru (atau ambil alih data yatim dari instalasi lama) */
export async function seedUserCategories(userId: number, ex?: Executor) {
  const adopted = await execute("UPDATE categories SET user_id = ? WHERE user_id = 0", [userId], ex);
  await execute("UPDATE transactions SET user_id = ? WHERE user_id = 0", [userId], ex);
  if (adopted.rowsAffected > 0) return;
  const values: any[] = [];
  const placeholders: string[] = [];
  for (const type of ["in", "out"] as const) {
    DEFAULT_CATEGORIES[type].forEach(([name, icon], i) => {
      placeholders.push("(?, ?, ?, ?, ?)");
      values.push(userId, type, name, icon, i);
    });
  }
  await execute(`INSERT IGNORE INTO categories (user_id, type, name, icon, sort) VALUES ${placeholders.join(", ")}`, values, ex);
}

// ---------- Pengaturan global ----------
export async function getSetting(key: string): Promise<string | null> {
  const row = await queryOne<{ v: string }>("SELECT v FROM settings WHERE k = ?", [key]);
  return row ? row.v : null;
}

export async function setSetting(key: string, value: string | number | null, ex?: Executor) {
  if (value === null) {
    await execute("DELETE FROM settings WHERE k = ?", [key], ex);
  } else {
    await execute("INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)", [key, String(value)], ex);
  }
}

// ---------- Pengaturan per pengguna ----------
export async function getUserSetting(userId: number, key: string): Promise<string | null> {
  const row = await queryOne<{ v: string }>("SELECT v FROM user_settings WHERE user_id = ? AND k = ?", [userId, key]);
  return row ? row.v : null;
}

export async function setUserSetting(userId: number, key: string, value: string | number | null, ex?: Executor) {
  if (value === null) {
    await execute("DELETE FROM user_settings WHERE user_id = ? AND k = ?", [userId, key], ex);
  } else {
    await execute(
      "INSERT INTO user_settings (user_id, k, v) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)",
      [userId, key, String(value)],
      ex,
    );
  }
}
