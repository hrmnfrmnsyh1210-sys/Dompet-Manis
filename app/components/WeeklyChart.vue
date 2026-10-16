<script setup lang="ts">
// Grafik batang berkelompok: pemasukan vs pengeluaran per minggu (6 minggu terakhir)
import type { Trx } from "~/composables/useFinance";

const props = withDefaults(defineProps<{ trx: Trx[]; weeks?: number }>(), { weeks: 6 });
const hover = ref<number | null>(null);

const data = computed(() => {
  // Awal minggu = Senin
  const today = new Date();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  const buckets = Array.from({ length: props.weeks }, (_, i) => {
    const start = new Date(monday);
    start.setDate(monday.getDate() - 7 * (props.weeks - 1 - i));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: toISODate(start), end: toISODate(end), tin: 0, tout: 0 };
  });
  const first = buckets[0]!.start;
  for (const t of props.trx) {
    if (t.date < first) continue;
    const b = buckets.find((w) => t.date >= w.start && t.date <= w.end);
    if (!b) continue;
    if (t.type === "in") b.tin += t.amount;
    else b.tout += t.amount;
  }
  return buckets;
});

const max = computed(() => Math.max(1, ...data.value.flatMap((w) => [w.tin, w.tout])));
const pct = (v: number) => (v ? Math.max(4, (v / max.value) * 100) : 0) + "%";
const label = (w: { start: string; end: string }) => `${formatDate(w.start, false)} – ${formatDate(w.end, false)}`;
</script>

<template>
  <div>
    <div class="chart-legend">
      <span><i style="background: var(--c-in)" />Pemasukan</span>
      <span><i style="background: var(--c-out)" />Pengeluaran</span>
    </div>
    <div class="chart" role="img" :aria-label="`Pemasukan dan pengeluaran ${weeks} minggu terakhir`">
      <div
        v-for="(w, i) in data" :key="w.start" class="week" tabindex="0"
        @mouseenter="hover = i" @mouseleave="hover = null" @focus="hover = i" @blur="hover = null"
      >
        <div v-if="hover === i" class="tooltip">
          <b>{{ label(w) }}</b>
          <div class="row"><span><i style="background: var(--c-in)" />Masuk</span><span>{{ rupiah(w.tin) }}</span></div>
          <div class="row"><span><i style="background: var(--c-out)" />Keluar</span><span>{{ rupiah(w.tout) }}</span></div>
          <div class="row"><span>Selisih</span><span>{{ rupiah(w.tin - w.tout) }}</span></div>
        </div>
        <div class="week-bars">
          <div class="bar-v in" :style="{ height: pct(w.tin) }" />
          <div class="bar-v out" :style="{ height: pct(w.tout) }" />
        </div>
        <span class="week-label">{{ formatDate(w.start, false) }}</span>
      </div>
    </div>
  </div>
</template>
