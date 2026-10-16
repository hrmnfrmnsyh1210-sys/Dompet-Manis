<script setup lang="ts">
import type { TrxType } from "~/composables/useFinance";

const modal = useTrxModal();
const { fin, load, catsOf } = useFinance();
const { show, fail } = useToast();

const form = reactive({ type: "out" as TrxType, date: todayISO(), category_id: 0, amount: "", note: "" });
const saving = ref(false);
const amountInput = ref<HTMLInputElement>();
const isEdit = computed(() => modal.value.editId != null);
const options = computed(() => catsOf(form.type));

watch(() => modal.value.open, (open) => {
  if (!open) return;
  const t = isEdit.value ? fin.value.trx.find((x) => x.id === modal.value.editId) : null;
  if (t) {
    Object.assign(form, { type: t.type, date: t.date, category_id: t.category_id, amount: t.amount.toLocaleString("id-ID"), note: t.note });
  } else {
    Object.assign(form, { type: modal.value.type, date: todayISO(), category_id: catsOf(modal.value.type)[0]?.id ?? 0, amount: "", note: "" });
  }
  nextTick(() => amountInput.value?.focus());
});

function setType(type: TrxType) {
  form.type = type;
  if (!options.value.some((c) => c.id === form.category_id)) form.category_id = options.value[0]?.id ?? 0;
}

function close() {
  modal.value.open = false;
}

async function save() {
  const amount = parseAmount(form.amount);
  if (amount <= 0) return show("Jumlahnya diisi dulu ya", true);
  if (!form.category_id) return show("Pilih kategorinya dulu ya", true);
  saving.value = true;
  const body = { type: form.type, date: form.date, category_id: form.category_id, amount, note: form.note.trim() };
  try {
    if (isEdit.value) {
      await api(`/api/transactions/${modal.value.editId}`, { method: "PUT", body });
      show("Transaksi diperbarui");
    } else {
      await api("/api/transactions", { method: "POST", body });
      show(form.type === "in" ? "Yay, pemasukan tercatat!" : "Pengeluaran tercatat");
    }
    await load();
    close();
  } catch (e) {
    fail(e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div v-if="modal.open" class="modal" @click.self="close">
    <form class="modal-box modal-wide" @submit.prevent="save">
      <span class="modal-ic tone-pink"><Icon :name="isEdit ? 'mingcute:edit-2-line' : 'mingcute:quill-pen-line'" /></span>
      <h3>{{ isEdit ? "Edit Transaksi" : "Catat Transaksi" }}</h3>
      <p>{{ isEdit ? "Ubah detail transaksimu" : "Uang masuk atau keluar hari ini?" }}</p>

      <div class="seg">
        <button type="button" class="in" :class="{ on: form.type === 'in' }" @click="setType('in')">
          <ArrowBadge type="in" /> Pemasukan
        </button>
        <button type="button" class="out" :class="{ on: form.type === 'out' }" @click="setType('out')">
          <ArrowBadge type="out" /> Pengeluaran
        </button>
      </div>

      <label class="field">
        <span>Jumlah (Rp)</span>
        <input ref="amountInput" :value="form.amount" inputmode="numeric" placeholder="cth: 50.000" required
               @input="form.amount = formatThousands(($event.target as HTMLInputElement).value)" />
      </label>

      <div class="field">
        <span>Kategori <NuxtLink to="/kategori" class="field-link" @click="close">atur kategori</NuxtLink></span>
        <div class="cat-choices" role="radiogroup" aria-label="Kategori">
          <button
            v-for="c in options" :key="c.id" type="button" class="cat-choice" role="radio"
            :aria-checked="form.category_id === c.id" :class="{ on: form.category_id === c.id }" @click="form.category_id = c.id"
          >
            <CatIcon :icon="c.icon" size="sm" />
            <span>{{ c.name }}</span>
          </button>
        </div>
      </div>

      <div class="field-row-2">
        <label class="field">
          <span>Tanggal</span>
          <input v-model="form.date" type="date" required />
        </label>
        <label class="field">
          <span>Keterangan</span>
          <input v-model="form.note" maxlength="200" placeholder="cth: Beli skincare" />
        </label>
      </div>

      <div class="actions">
        <button class="btn btn-primary" :disabled="saving"><Icon name="mingcute:check-line" /> {{ isEdit ? "Update" : "Simpan" }}</button>
        <button type="button" class="btn btn-ghost" @click="close">Batal</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.field-link { font-size: 0.78rem; color: var(--pink-500); font-weight: 800; }
.seg :deep(.arrow) { width: 22px; height: 22px; }
.seg .on :deep(.arrow) { background: #fff; }
</style>
