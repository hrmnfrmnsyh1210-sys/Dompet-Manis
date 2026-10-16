<script setup lang="ts">
useHead({ title: "Pengguna · Dompet Manis" });

type Role = "admin" | "user";
type UserRow = {
  id: number; username: string; role: Role; createdAt: number; lastActivity: number | null; count: number;
  saldoAwal: number; saldo: number; totalIn: number; totalOut: number; monthIn: number; monthOut: number;
};

const { fin } = useFinance();
const { show, fail } = useToast();

// Periode: "all" = semua waktu, atau bulan YYYY-MM (12 bulan terakhir)
const months = (() => {
  const d = new Date();
  return Array.from({ length: 12 }, (_, i) => toISODate(new Date(d.getFullYear(), d.getMonth() - i, 1)).slice(0, 7));
})();
const period = ref<string>(thisMonth());
const users = ref<UserRow[]>([]);
const loading = ref(true);

async function load() {
  try {
    const month = period.value === "all" ? thisMonth() : period.value;
    users.value = (await api<{ users: UserRow[] }>(`/api/admin/users?month=${month}`)).users;
  } catch (e) {
    fail(e);
  } finally {
    loading.value = false;
  }
}
onMounted(load);
watch(period, load);

const inOf = (u: UserRow) => (period.value === "all" ? u.totalIn : u.monthIn);
const outOf = (u: UserRow) => (period.value === "all" ? u.totalOut : u.monthOut);
const scale = computed(() => Math.max(1, ...users.value.flatMap((u) => [inOf(u), outOf(u)])));
const pct = (v: number) => (v ? Math.max(3, (v / scale.value) * 100) : 0) + "%";
const totals = computed(() => ({
  in: users.value.reduce((s, u) => s + inOf(u), 0),
  out: users.value.reduce((s, u) => s + outOf(u), 0),
}));

function fmtDate(ms: number | null) {
  return ms ? formatDate(toISODate(new Date(ms))) : "belum ada";
}

// ---------- Pendaftaran mandiri ----------
const auth = useAuthStatus();
const regOpen = ref(!!auth.value?.registrationOpen);
async function toggleRegistration() {
  try {
    await api("/api/admin/registration", { method: "PUT", body: { open: regOpen.value } });
    if (auth.value) auth.value.registrationOpen = regOpen.value;
    show(regOpen.value ? "Pendaftaran dibuka untuk umum" : "Pendaftaran ditutup");
  } catch (e) {
    regOpen.value = !regOpen.value;
    fail(e);
  }
}

// ---------- Tambah pengguna ----------
const addOpen = ref(false);
const addForm = reactive({ username: "", password: "", role: "user" as Role });
async function addUser() {
  try {
    await api("/api/admin/users", { method: "POST", body: { ...addForm } });
    show(`Pengguna "${addForm.username}" ditambahkan`);
    Object.assign(addForm, { username: "", password: "", role: "user" });
    addOpen.value = false;
    await load();
  } catch (e) {
    fail(e);
  }
}

// ---------- Reset password ----------
const resetTarget = ref<UserRow | null>(null);
const resetPw = ref("");
async function resetPassword() {
  if (!resetTarget.value) return;
  try {
    await api(`/api/admin/users/${resetTarget.value.id}`, { method: "PUT", body: { password: resetPw.value } });
    show(`Password ${resetTarget.value.username} sudah direset`);
    resetTarget.value = null;
    resetPw.value = "";
  } catch (e) {
    fail(e);
  }
}

// ---------- Ubah peran ----------
async function toggleRole(u: UserRow) {
  const next: Role = u.role === "admin" ? "user" : "admin";
  const msg = next === "admin"
    ? `Jadikan ${u.username} admin? Admin bisa mengelola semua pengguna.`
    : `Turunkan ${u.username} menjadi pengguna biasa?`;
  if (!confirm(msg)) return;
  try {
    await api(`/api/admin/users/${u.id}`, { method: "PUT", body: { role: next } });
    show(next === "admin" ? `${u.username} sekarang admin` : `${u.username} sekarang pengguna biasa`);
    await load();
  } catch (e) {
    fail(e);
  }
}

// ---------- Hapus ----------
const delTarget = ref<UserRow | null>(null);
const delConfirm = ref("");
async function deleteUser() {
  if (!delTarget.value || delConfirm.value !== delTarget.value.username) return;
  try {
    await api(`/api/admin/users/${delTarget.value.id}`, { method: "DELETE" });
    show(`Pengguna ${delTarget.value.username} dihapus`);
    delTarget.value = null;
    delConfirm.value = "";
    await load();
  } catch (e) {
    fail(e);
  }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1 class="page-title">Pengguna</h1>
        <p class="page-sub">Kelola akun & lihat ringkasan keuangan tiap pengguna</p>
      </div>
      <button class="btn btn-primary" type="button" @click="addOpen = true"><Icon name="mingcute:user-add-2-line" /> Tambah Pengguna</button>
    </div>

    <div class="toolbar">
      <select v-model="period" class="input" title="Periode">
        <option value="all">Semua waktu</option>
        <option v-for="m in months" :key="m" :value="m">{{ monthLabel(m) }}</option>
      </select>
      <div class="chart-legend" style="margin: 0">
        <span><i style="background: var(--c-in)" />Pemasukan</span>
        <span><i style="background: var(--c-out)" />Pengeluaran</span>
      </div>
      <label class="check" style="margin: 0 0 0 auto" title="Jika aktif, siapa pun bisa membuat akun sendiri dari halaman login">
        <input v-model="regOpen" type="checkbox" @change="toggleRegistration" />
        Pendaftaran terbuka untuk umum
      </label>
    </div>

    <div class="pills">
      <div class="pill"><span class="pill-label">Jumlah pengguna</span><b class="pill-num">{{ users.length }}</b></div>
      <div class="pill"><span class="pill-label">Pemasukan semua akun</span><Money :value="totals.in" signed="in" /></div>
      <div class="pill"><span class="pill-label">Pengeluaran semua akun</span><Money :value="totals.out" signed="out" /></div>
    </div>

    <div v-if="loading" class="loading"><Icon name="mingcute:rabbit-line" class="loading-ic" /> Memuat...</div>
    <div v-else class="user-grid">
      <article v-for="u in users" :key="u.id" class="user-card">
        <header class="user-head">
          <span class="user-avatar" :class="`tone-${toneOf(u.username)}`">{{ u.username.charAt(0) }}</span>
          <div class="user-id">
            <b>{{ u.username }} <small v-if="u.username === fin.username">(kamu)</small></b>
            <span class="role-badge" :class="u.role">
              <Icon :name="u.role === 'admin' ? 'mingcute:vip-1-fill' : 'mingcute:user-3-line'" />
              {{ u.role === "admin" ? "Admin" : "Pengguna" }}
            </span>
          </div>
        </header>

        <div class="user-saldo">
          <span class="pill-label">Saldo saat ini</span>
          <Money :value="u.saldo" />
        </div>

        <div class="user-bars">
          <div class="ub-row">
            <div class="ub-head"><span><ArrowBadge type="in" /> Pemasukan</span><Money :value="inOf(u)" signed="in" /></div>
            <div class="ub-track"><div class="ub-fill in" :style="{ width: pct(inOf(u)) }" /></div>
          </div>
          <div class="ub-row">
            <div class="ub-head"><span><ArrowBadge type="out" /> Pengeluaran</span><Money :value="outOf(u)" signed="out" /></div>
            <div class="ub-track"><div class="ub-fill out" :style="{ width: pct(outOf(u)) }" /></div>
          </div>
        </div>

        <ul class="user-meta">
          <li><Icon name="mingcute:transfer-line" /> {{ u.count }} transaksi</li>
          <li><Icon name="mingcute:time-line" /> Aktif terakhir: {{ fmtDate(u.lastActivity) }}</li>
          <li><Icon name="mingcute:calendar-line" /> Bergabung {{ fmtDate(u.createdAt) }}</li>
        </ul>

        <footer class="user-actions">
          <button class="btn btn-ghost btn-sm" type="button" @click="resetTarget = u; resetPw = ''">
            <Icon name="mingcute:key-2-line" /> Reset password
          </button>
          <template v-if="u.username !== fin.username">
            <button class="icon-btn" type="button" :title="u.role === 'admin' ? 'Jadikan pengguna biasa' : 'Jadikan admin'" @click="toggleRole(u)">
              <Icon :name="u.role === 'admin' ? 'mingcute:user-3-line' : 'mingcute:vip-1-line'" />
            </button>
            <button class="icon-btn" type="button" title="Hapus pengguna" @click="delTarget = u; delConfirm = ''">
              <Icon name="mingcute:user-remove-2-line" />
            </button>
          </template>
        </footer>
      </article>
    </div>

    <!-- Tambah pengguna -->
    <div v-if="addOpen" class="modal" @click.self="addOpen = false">
      <form class="modal-box" @submit.prevent="addUser">
        <span class="modal-ic tone-pink"><Icon name="mingcute:user-add-2-line" /></span>
        <h3>Tambah Pengguna</h3>
        <p>Pengguna baru punya kategori, transaksi & saldo sendiri yang terpisah dari akunmu.</p>
        <label class="field"><span>Username</span><input v-model="addForm.username" autocomplete="off" required maxlength="30" placeholder="cth: dinda" /></label>
        <label class="field"><span>Password awal</span><input v-model="addForm.password" type="text" autocomplete="new-password" required minlength="8" maxlength="200" placeholder="minimal 8 karakter" /></label>
        <div class="field">
          <span>Peran</span>
          <div class="seg">
            <button type="button" class="in" :class="{ on: addForm.role === 'user' }" @click="addForm.role = 'user'"><Icon name="mingcute:user-3-line" /> Pengguna</button>
            <button type="button" class="out" :class="{ on: addForm.role === 'admin' }" @click="addForm.role = 'admin'"><Icon name="mingcute:vip-1-line" /> Admin</button>
          </div>
        </div>
        <div class="actions">
          <button class="btn btn-primary"><Icon name="mingcute:check-line" /> Simpan</button>
          <button type="button" class="btn btn-ghost" @click="addOpen = false">Batal</button>
        </div>
      </form>
    </div>

    <!-- Reset password -->
    <div v-if="resetTarget" class="modal" @click.self="resetTarget = null">
      <form class="modal-box" @submit.prevent="resetPassword">
        <span class="modal-ic tone-sky"><Icon name="mingcute:key-2-line" /></span>
        <h3>Reset password {{ resetTarget.username }}</h3>
        <p>Berikan password baru ini ke pemilik akun. Semua perangkatnya akan otomatis keluar.</p>
        <label class="field"><span>Password baru</span><input v-model="resetPw" type="text" autocomplete="new-password" required minlength="8" maxlength="200" placeholder="minimal 8 karakter" /></label>
        <div class="actions">
          <button class="btn btn-primary"><Icon name="mingcute:check-line" /> Reset</button>
          <button type="button" class="btn btn-ghost" @click="resetTarget = null">Batal</button>
        </div>
      </form>
    </div>

    <!-- Hapus pengguna -->
    <div v-if="delTarget" class="modal" @click.self="delTarget = null">
      <form class="modal-box" @submit.prevent="deleteUser">
        <span class="modal-ic tone-pink"><Icon name="mingcute:user-remove-2-line" /></span>
        <h3>Hapus {{ delTarget.username }}?</h3>
        <p>Akun beserta <b>{{ delTarget.count }} transaksi</b>, kategori, dan API key-nya akan dihapus permanen. Ketik <b>{{ delTarget.username }}</b> untuk konfirmasi.</p>
        <label class="field"><input v-model="delConfirm" autocomplete="off" :placeholder="delTarget.username" /></label>
        <div class="actions">
          <button class="btn btn-danger" :disabled="delConfirm !== delTarget.username">Hapus permanen</button>
          <button type="button" class="btn btn-ghost" @click="delTarget = null">Batal</button>
        </div>
      </form>
    </div>
  </div>
</template>
