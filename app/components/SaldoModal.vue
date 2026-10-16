<script setup lang="ts">
const open = useSaldoModal();
const { fin, load } = useFinance();
const { show, fail } = useToast();
const value = ref("");
const saving = ref(false);
const input = ref<HTMLInputElement>();

watch(open, (v) => {
  if (!v) return;
  value.value = fin.value.saldoAwal ? fin.value.saldoAwal.toLocaleString("id-ID") : "";
  nextTick(() => input.value?.focus());
});

async function save() {
  saving.value = true;
  try {
    await api("/api/settings/saldo", { method: "PUT", body: { saldoAwal: parseAmount(value.value) } });
    await load();
    open.value = false;
    show("Saldo awal disimpan");
  } catch (e) {
    fail(e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div v-if="open" class="modal" @click.self="open = false">
    <form class="modal-box" @submit.prevent="save">
      <span class="modal-ic tone-pink"><Icon name="mingcute:wallet-4-line" /></span>
      <h3>Atur Saldo Awal</h3>
      <p>Jumlah uang yang kamu punya saat mulai mencatat</p>
      <label class="field">
        <span>Saldo awal (Rp)</span>
        <input ref="input" :value="value" inputmode="numeric" placeholder="cth: 1.000.000" @input="value = formatThousands(($event.target as HTMLInputElement).value)" />
      </label>
      <div class="actions">
        <button class="btn btn-primary" :disabled="saving"><Icon name="mingcute:check-line" /> Simpan</button>
        <button type="button" class="btn btn-ghost" @click="open = false">Batal</button>
      </div>
    </form>
  </div>
</template>
