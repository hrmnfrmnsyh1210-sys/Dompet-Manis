<script setup lang="ts">
const { fin, load, totals, catById } = useFinance();
const modal = useTrxModal();
const auth = useAuthStatus();
const { show, fail } = useToast();
const route = useRoute();
const search = ref("");
const featured = ref(1);

onMounted(() => {
  if (!fin.value.loaded) load().catch(fail);
});

function openTrx(type: "in" | "out") {
  modal.value = { open: true, editId: null, type };
}

function doSearch() {
  navigateTo({ path: "/transaksi", query: search.value.trim() ? { q: search.value.trim() } : {} });
}

async function quickExport(kind: "pdf" | "excel") {
  try {
    const r = buildReport(fin.value.saldoAwal, fin.value.trx, catById, { month: thisMonth(), type: "all", q: "" });
    await (kind === "pdf" ? exportPdf(r) : exportExcel(r));
    show(kind === "pdf" ? "Laporan PDF bulan ini diunduh" : "Laporan Excel bulan ini diunduh");
  } catch (e) {
    fail(e);
  }
}

async function logout() {
  await api("/api/auth/logout", { method: "POST" }).catch(() => {});
  auth.value = null;
  fin.value.loaded = false;
  await navigateTo("/login");
}

const quick = [
  { icon: "mingcute:add-circle-line", tone: "sky", label: "Pemasukan", run: () => openTrx("in") },
  { icon: "mingcute:shopping-bag-1-line", tone: "pink", label: "Pengeluaran", run: () => openTrx("out") },
  { icon: "mingcute:tag-2-line", tone: "blush", label: "Kategori", run: () => navigateTo("/kategori") },
  { icon: "mingcute:pdf-line", tone: "pink", label: "PDF bulan ini", run: () => quickExport("pdf") },
  { icon: "mingcute:xls-line", tone: "mint", label: "Excel bulan ini", run: () => quickExport("excel") },
  { icon: "mingcute:settings-3-line", tone: "sky", label: "Pengaturan", run: () => navigateTo("/pengaturan") },
];

const tabs = computed(() => [
  { to: "/", label: "Dashboard" },
  { to: "/transaksi", label: "Transaksi" },
  { to: "/kategori", label: "Kategori" },
  { to: "/pengaturan", label: "Pengaturan" },
  ...(fin.value.role === "admin" ? [{ to: "/pengguna", label: "Pengguna" }] : []),
]);

watch(() => route.query.q, (q) => (search.value = String(q ?? "")), { immediate: true });
</script>

<template>
  <div class="page">
    <div class="shell">
      <aside class="sidebar">
        <div class="brand-row">
          <NuxtLink to="/" class="brand"><span class="brand-logo"><Icon name="mingcute:bowknot-fill" /></span> Dompet Manis</NuxtLink>
          <div class="avatar" :title="`${fin.username} (${fin.role === 'admin' ? 'Admin' : 'Pengguna'})`">
            {{ (fin.username || "?").charAt(0) }}
            <span v-if="fin.role === 'admin'" class="avatar-crown"><Icon name="mingcute:vip-1-fill" /></span>
          </div>
        </div>

        <form class="search" @submit.prevent="doSearch">
          <Icon name="mingcute:search-line" class="ic-18" />
          <input v-model="search" type="search" placeholder="Cari transaksi..." />
        </form>

        <div class="stats">
          <div class="stat">
            <ArrowBadge type="in" />
            <span class="stat-label">Pemasukan<br /><small>bulan ini</small></span>
            <Money class="stat-value" :value="totals.monthIn" signed="in" />
          </div>
          <div class="stat">
            <ArrowBadge type="out" />
            <span class="stat-label">Pengeluaran<br /><small>bulan ini</small></span>
            <Money class="stat-value" :value="totals.monthOut" signed="out" />
          </div>
        </div>

        <div>
          <p class="side-title">Menu cepat</p>
          <div class="quick">
            <button
              v-for="(q, i) in quick" :key="q.label" type="button" class="tile"
              :class="{ featured: featured === i }" :title="q.label" @click="q.run(); featured = i"
            >
              <span class="tile-ic" :class="`tone-${q.tone}`"><Icon :name="q.icon" /></span><small>{{ q.label }}</small>
            </button>
          </div>
        </div>

        <div class="side-foot">
          <button class="logout" type="button" @click="logout"><Icon name="mingcute:exit-line" class="ic-16" /> Keluar</button>
        </div>
      </aside>

      <main class="main">
        <div class="blob" aria-hidden="true" />
        <header class="topbar">
          <nav class="tabs">
            <NuxtLink v-for="t in tabs" :key="t.to" :to="t.to" class="tab">{{ t.label }}</NuxtLink>
          </nav>
          <button class="add-btn" type="button" @click="openTrx('out')">
            <span class="ic"><Icon name="mingcute:add-line" /></span> Catat Transaksi
          </button>
        </header>

        <div v-if="!fin.loaded" class="loading"><Icon name="mingcute:rabbit-line" class="loading-ic" /> Memuat dompetmu...</div>
        <slot v-else />
      </main>
    </div>

    <TrxModal />
    <SaldoModal />
  </div>
</template>
