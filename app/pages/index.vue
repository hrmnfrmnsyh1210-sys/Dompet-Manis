<script setup lang="ts">
useHead({ title: "Dashboard · Dompet Manis" });

const { fin, totals, catById } = useFinance();
const modal = useTrxModal();
const saldoModal = useSaldoModal();

const month = thisMonth();
const recent = computed(() => [...fin.value.trx].reverse().slice(0, 6));
const breakdown = computed(() => buildReport(fin.value.saldoAwal, fin.value.trx, catById, { month, type: "all", q: "" }).categories);
const breakdownTotal = computed(() => breakdown.value.reduce((s, c) => s + c.total, 0));

onMounted(() => {
  // Pertama kali: minta isi saldo awal
  if (!fin.value.saldoAwal && !fin.value.trx.length) setTimeout(() => (saldoModal.value = true), 400);
});
</script>

<template>
  <div>
    <h1 class="page-title">Dashboard</h1>
    <p class="page-sub">{{ greeting() }}, {{ fin.username }}! <Icon name="mingcute:flower-fill" class="inline-ic" /></p>

    <section class="cards">
      <div class="gcard mint">
        <div class="gcard-icon ic-mint"><Icon name="mingcute:coin-fill" /></div>
        <span class="gcard-label">Pemasukan</span>
        <span class="gcard-sub">{{ monthLabel(month) }}</span>
        <Money :value="totals.monthIn" />
      </div>

      <div class="gcard rose">
        <div class="gcard-icon ic-pink"><Icon name="mingcute:wallet-4-fill" /></div>
        <span class="gcard-label">Saldo saat ini</span>
        <span class="gcard-sub">Awal: {{ rupiah(fin.saldoAwal) }}</span>
        <button class="gcard-link" type="button" @click="saldoModal = true"><Icon name="mingcute:edit-2-line" /> Ubah saldo awal</button>
        <Money :value="totals.saldo" />
      </div>

      <div class="gcard sky">
        <div class="gcard-icon ic-sky"><Icon name="mingcute:shopping-bag-1-fill" /></div>
        <span class="gcard-label">Pengeluaran</span>
        <span class="gcard-sub">{{ monthLabel(month) }}</span>
        <Money :value="totals.monthOut" />
      </div>

      <NuxtLink to="/transaksi" class="round-next" title="Lihat semua transaksi"><Icon name="mingcute:right-line" /></NuxtLink>
    </section>

    <div class="dash-bottom">
      <section>
        <h2 class="section-title">Arus kas 6 minggu terakhir</h2>
        <div class="panel"><WeeklyChart :trx="fin.trx" /></div>
      </section>

      <section>
        <h2 class="section-title">Transaksi terbaru</h2>
        <div v-if="recent.length" class="recent">
          <button
            v-for="t in recent" :key="t.id" type="button" class="recent-item" :title="t.note || catById(t.category_id).name"
            @click="modal = { open: true, editId: t.id, type: t.type }"
          >
            <CatIcon :icon="catById(t.category_id).icon" size="lg" />
            <span class="recent-name">{{ catById(t.category_id).name }}</span>
            <ArrowBadge :type="t.type" />
            <Money :value="t.amount" :signed="t.type" />
          </button>
        </div>
        <div v-else class="empty">
          <Icon name="mingcute:rabbit-line" class="empty-ic" />
          <p>Belum ada transaksi nih~<br />Yuk mulai catat!</p>
        </div>
      </section>
    </div>

    <section style="margin-top: 40px">
      <h2 class="section-title">Pengeluaran per kategori <small>· {{ monthLabel(month) }}</small></h2>
      <div class="panel">
        <div v-if="breakdown.length" class="breakdown">
          <div v-for="b in breakdown" :key="b.cat.id" class="bd-row">
            <div class="bd-head">
              <span class="bd-name"><CatIcon :icon="b.cat.icon" size="sm" /> {{ b.cat.name }}</span>
              <span>{{ rupiah(b.total) }} · {{ Math.round((b.total / breakdownTotal) * 100) }}%</span>
            </div>
            <div class="bd-track"><div class="bd-fill" :style="{ width: (b.total / breakdown[0]!.total) * 100 + '%' }" /></div>
          </div>
        </div>
        <p v-else class="empty" style="padding: 12px">Belum ada pengeluaran bulan ini</p>
      </div>
    </section>
  </div>
</template>
