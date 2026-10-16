<script setup lang="ts">
import type { ReportFilter } from "~/utils/report";

useHead({ title: "Transaksi · Dompet Manis" });

const { fin, load, catById } = useFinance();
const modal = useTrxModal();
const { show, fail } = useToast();
const route = useRoute();

const filter = reactive<ReportFilter>({ month: thisMonth(), type: "all", q: String(route.query.q ?? "") });
watch(() => route.query.q, (q) => (filter.q = String(q ?? "")));

const months = computed(() => {
  const set = new Set(fin.value.trx.map((t) => t.date.slice(0, 7)));
  set.add(thisMonth());
  return [...set].sort().reverse();
});

const report = computed(() => buildReport(fin.value.saldoAwal, fin.value.trx, catById, { ...filter }));
const rows = computed(() => [...report.value.rows].reverse());
const exporting = ref(false);

async function doExport(kind: "pdf" | "excel") {
  exporting.value = true;
  try {
    await (kind === "pdf" ? exportPdf(report.value) : exportExcel(report.value));
    show(kind === "pdf" ? "PDF berhasil diunduh" : "Excel berhasil diunduh");
  } catch (e) {
    fail(e);
  } finally {
    exporting.value = false;
  }
}

async function remove(id: number) {
  if (!confirm("Yakin mau hapus transaksi ini?")) return;
  try {
    await api(`/api/transactions/${id}`, { method: "DELETE" });
    await load();
    show("Transaksi dihapus");
  } catch (e) {
    fail(e);
  }
}
</script>

<template>
  <div>
    <h1 class="page-title">Transaksi</h1>
    <p class="page-sub">Semua catatan uang masuk & keluar</p>

    <div class="toolbar">
      <select v-model="filter.month" class="input" title="Periode">
        <option value="all">Semua bulan</option>
        <option v-for="m in months" :key="m" :value="m">{{ monthLabel(m) }}</option>
      </select>
      <div class="chips">
        <button type="button" class="chip" :class="{ on: filter.type === 'all' }" @click="filter.type = 'all'">Semua</button>
        <button type="button" class="chip" :class="{ on: filter.type === 'in' }" @click="filter.type = 'in'">Masuk</button>
        <button type="button" class="chip" :class="{ on: filter.type === 'out' }" @click="filter.type = 'out'">Keluar</button>
      </div>
      <label class="search-box grow"><Icon name="mingcute:search-line" class="ic-18" /><input v-model="filter.q" type="search" placeholder="Cari kategori / keterangan..." /></label>
      <button class="btn btn-white btn-sm" :disabled="exporting" @click="doExport('pdf')"><Icon name="mingcute:pdf-line" class="ic-18" /> PDF</button>
      <button class="btn btn-white btn-sm" :disabled="exporting" @click="doExport('excel')"><Icon name="mingcute:xls-line" class="ic-18" /> Excel</button>
    </div>

    <div class="pills">
      <div class="pill"><span class="pill-label">Saldo awal periode</span><Money :value="report.opening" /></div>
      <div class="pill"><span class="pill-label">Pemasukan</span><Money :value="report.totalIn" signed="in" /></div>
      <div class="pill"><span class="pill-label">Pengeluaran</span><Money :value="report.totalOut" signed="out" /></div>
      <div class="pill"><span class="pill-label">Saldo akhir periode</span><Money :value="report.closing" /></div>
    </div>

    <div v-if="rows.length" class="trx-list">
      <div v-for="t in rows" :key="t.id" class="trx-item">
        <CatIcon :icon="t.icon" size="lg" />
        <div class="trx-main">
          <div class="trx-cat">
            {{ t.category }}
            <span v-if="t.source !== 'web'" class="src-badge" :title="`Dicatat lewat ${t.source}`"><Icon name="mingcute:robot-line" /> {{ t.source }}</span>
          </div>
          <div class="trx-note">{{ t.note || "—" }}</div>
          <div class="trx-date">{{ formatDate(t.date) }}</div>
        </div>
        <div class="trx-amount">
          <ArrowBadge :type="t.type" />
          <Money :value="t.amount" :signed="t.type" />
        </div>
        <div class="trx-actions">
          <button class="icon-btn" title="Edit" @click="modal = { open: true, editId: t.id, type: t.type }"><Icon name="mingcute:edit-2-line" /></button>
          <button class="icon-btn" title="Hapus" @click="remove(t.id)"><Icon name="mingcute:delete-2-line" /></button>
        </div>
      </div>
    </div>
    <div v-else class="panel empty">
      <Icon name="mingcute:rabbit-line" class="empty-ic" />
      <p>Tidak ada transaksi di filter ini</p>
    </div>
  </div>
</template>
