<script setup lang="ts">
useHead({ title: "Pengaturan · Dompet Manis" });

const { fin, load } = useFinance();
const saldoModal = useSaldoModal();
const { show, fail } = useToast();

// ---------- Password ----------
const pw = reactive({ current: "", next: "", next2: "" });
async function changePassword() {
  if (pw.next !== pw.next2) return show("Password baru tidak sama", true);
  try {
    await api("/api/auth/password", { method: "POST", body: { current: pw.current, next: pw.next } });
    Object.assign(pw, { current: "", next: "", next2: "" });
    show("Password berhasil diganti");
  } catch (e) {
    fail(e);
  }
}

// ---------- API key ----------
const keyStatus = ref<{ active: boolean; createdAt: number | null }>({ active: false, createdAt: null });
const newKey = ref("");
const origin = import.meta.client ? location.origin : "";

async function loadKey() {
  try {
    keyStatus.value = await api("/api/apikey");
  } catch (e) {
    fail(e);
  }
}
onMounted(loadKey);

async function generateKey() {
  if (keyStatus.value.active && !confirm("Key lama akan langsung tidak berlaku. Lanjut?")) return;
  try {
    newKey.value = (await api<{ key: string }>("/api/apikey", { method: "POST" })).key;
    await loadKey();
  } catch (e) {
    fail(e);
  }
}

async function revokeKey() {
  if (!confirm("Cabut API Key? Bot tidak akan bisa mencatat lagi sampai dibuat key baru.")) return;
  try {
    await api("/api/apikey", { method: "DELETE" });
    newKey.value = "";
    await loadKey();
    show("API Key dicabut");
  } catch (e) {
    fail(e);
  }
}

async function copyKey() {
  try {
    await navigator.clipboard.writeText(newKey.value);
    show("API Key disalin");
  } catch {
    show("Gagal menyalin, salin manual ya", true);
  }
}

const example = computed(() => {
  const key = newKey.value || "<API_KEY>";
  return `# Catat pengeluaran
curl -X POST ${origin}/api/transactions \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{"type":"out","amount":25000,"category":"Makan & Minum","note":"Boba","source":"telegram"}'

# Cek saldo & ringkasan bulan ini
curl ${origin}/api/summary -H "Authorization: Bearer ${key}"

# Daftar kategori (untuk prompt LLM)
curl ${origin}/api/categories -H "Authorization: Bearer ${key}"`;
});

// ---------- Zona bahaya ----------
const resetOpen = ref(false);
const resetPw = ref("");
async function doReset() {
  try {
    await api("/api/reset", { method: "POST", body: { password: resetPw.value } });
    resetOpen.value = false;
    resetPw.value = "";
    await load();
    show("Semua transaksi sudah dihapus");
  } catch (e) {
    fail(e);
  }
}
</script>

<template>
  <div>
    <h1 class="page-title">Pengaturan</h1>
    <p class="page-sub">Keamanan akun & integrasi bot</p>

    <div class="grid-2" style="margin-top: 28px">
      <section class="panel">
        <h2 class="panel-title"><span class="title-ic tone-pink"><Icon name="mingcute:key-2-line" /></span> Ganti Password</h2>
        <p class="panel-desc">Setelah diganti, semua perangkat lain otomatis keluar.</p>
        <form @submit.prevent="changePassword">
          <input type="text" autocomplete="username" :value="fin.username" hidden />
          <label class="field"><span>Password lama</span><input v-model="pw.current" type="password" autocomplete="current-password" required /></label>
          <label class="field"><span>Password baru</span><input v-model="pw.next" type="password" autocomplete="new-password" minlength="8" required /></label>
          <label class="field"><span>Ulangi password baru</span><input v-model="pw.next2" type="password" autocomplete="new-password" minlength="8" required /></label>
          <button class="btn btn-primary btn-block"><Icon name="mingcute:check-line" /> Simpan Password</button>
        </form>
      </section>

      <section class="panel">
        <h2 class="panel-title"><span class="title-ic tone-sky"><Icon name="mingcute:robot-line" /></span> Integrasi Bot Telegram / LLM</h2>
        <p class="panel-desc">
          Bot memakai <b>API Key</b> untuk mencatat ke dompet ini. Jaga baik-baik ya, siapa pun yang punya key ini bisa menambah & menghapus transaksi.
        </p>
        <p style="font-weight: 700; font-size: 0.9rem; margin-bottom: 12px">
          <template v-if="keyStatus.active"><Icon name="mingcute:check-circle-fill" class="inline-ic ok" /> Aktif sejak {{ new Date(keyStatus.createdAt!).toLocaleString("id-ID") }}</template>
          <template v-else><Icon name="mingcute:minus-circle-line" class="inline-ic" /> Belum ada API Key aktif</template>
        </p>
        <div v-if="newKey" class="notice">
          <b>Salin sekarang!</b> Key ini hanya ditampilkan sekali.
          <div class="key-box">
            <code>{{ newKey }}</code>
            <button class="btn btn-ghost btn-sm" type="button" @click="copyKey"><Icon name="mingcute:copy-2-line" /> Salin</button>
          </div>
        </div>
        <div class="actions">
          <button class="btn btn-primary" type="button" @click="generateKey"><Icon :name="keyStatus.active ? 'mingcute:refresh-2-line' : 'mingcute:key-2-line'" /> {{ keyStatus.active ? "Buat ulang key" : "Buat API Key" }}</button>
          <button v-if="keyStatus.active" class="btn btn-ghost" type="button" @click="revokeKey">Cabut key</button>
        </div>
        <details>
          <summary>Contoh pemakaian API</summary>
          <pre class="code">{{ example }}</pre>
        </details>
      </section>

      <section class="panel">
        <h2 class="panel-title"><span class="title-ic tone-mint"><Icon name="mingcute:wallet-4-line" /></span> Saldo Awal</h2>
        <p class="panel-desc">Jumlah uang yang kamu punya saat mulai mencatat.</p>
        <Money class="big-money" :value="fin.saldoAwal" />
        <button class="btn btn-ghost" type="button" @click="saldoModal = true"><Icon name="mingcute:edit-2-line" /> Ubah saldo awal</button>
      </section>

      <section class="panel">
        <h2 class="panel-title"><span class="title-ic tone-blush"><Icon name="mingcute:broom-line" /></span> Zona Bahaya</h2>
        <p class="panel-desc">Hapus semua transaksi dan atur ulang saldo awal ke 0. Kategori & akun tetap ada.</p>
        <button class="btn btn-danger" type="button" @click="resetOpen = true">Hapus semua transaksi</button>
      </section>
    </div>

    <div v-if="resetOpen" class="modal" @click.self="resetOpen = false">
      <form class="modal-box" @submit.prevent="doReset">
        <span class="modal-ic tone-pink"><Icon name="mingcute:delete-2-line" /></span>
        <h3>Yakin hapus semua?</h3>
        <p>Tindakan ini tidak bisa dibatalkan. Masukkan password untuk konfirmasi.</p>
        <label class="field"><input v-model="resetPw" type="password" autocomplete="current-password" placeholder="Password" required /></label>
        <div class="actions">
          <button class="btn btn-danger">Hapus</button>
          <button type="button" class="btn btn-ghost" @click="resetOpen = false">Batal</button>
        </div>
      </form>
    </div>
  </div>
</template>
