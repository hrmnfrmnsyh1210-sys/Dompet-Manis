<script setup lang="ts">
import type { Category, TrxType } from "~/composables/useFinance";

useHead({ title: "Kategori · Dompet Manis" });

const { load, catsOf } = useFinance();
const { show, fail } = useToast();

const groups: { type: TrxType; title: string }[] = [
  { type: "in", title: "Kategori Pemasukan" },
  { type: "out", title: "Kategori Pengeluaran" },
];

const newCat = reactive<Record<TrxType, { name: string; icon: string }>>({
  in: { name: "", icon: "coin" },
  out: { name: "", icon: "cake" },
});
const editing = reactive({ id: 0, name: "", icon: "" });
const moving = reactive({ cat: null as Category | null, target: 0 });

async function add(type: TrxType) {
  const name = newCat[type].name.trim();
  if (!name) return;
  try {
    await api("/api/categories", { method: "POST", body: { type, name, icon: newCat[type].icon } });
    newCat[type].name = "";
    await load();
    show(`Kategori "${name}" ditambahkan`);
  } catch (e) {
    fail(e);
  }
}

function startEdit(c: Category) {
  Object.assign(editing, { id: c.id, name: c.name, icon: c.icon });
}

async function saveEdit() {
  try {
    await api(`/api/categories/${editing.id}`, { method: "PUT", body: { name: editing.name, icon: editing.icon } });
    editing.id = 0;
    await load();
    show("Kategori diperbarui");
  } catch (e) {
    fail(e);
  }
}

async function remove(c: Category) {
  if (c.used > 0) {
    moving.cat = c;
    moving.target = catsOf(c.type).find((x) => x.id !== c.id)?.id ?? 0;
    return;
  }
  if (!confirm(`Hapus kategori "${c.name}"?`)) return;
  try {
    await api(`/api/categories/${c.id}`, { method: "DELETE" });
    await load();
    show("Kategori dihapus");
  } catch (e) {
    fail(e);
  }
}

async function confirmMove() {
  if (!moving.cat) return;
  try {
    const r = await api<{ moved: number }>(`/api/categories/${moving.cat.id}?moveTo=${moving.target}`, { method: "DELETE" });
    moving.cat = null;
    await load();
    show(`Kategori dihapus, ${r.moved} transaksi dipindahkan`);
  } catch (e) {
    fail(e);
  }
}
</script>

<template>
  <div>
    <h1 class="page-title">Kategori</h1>
    <p class="page-sub">Atur kelompok pemasukan & pengeluaranmu</p>

    <div class="grid-2" style="margin-top: 28px">
      <section v-for="g in groups" :key="g.type" class="panel">
        <h2 class="panel-title" style="display: flex; align-items: center; gap: 8px">
          <ArrowBadge :type="g.type" /> {{ g.title }}
        </h2>
        <p class="panel-desc">{{ catsOf(g.type).length }} kategori</p>

        <form class="cat-form" @submit.prevent="add(g.type)">
          <IconPicker v-model="newCat[g.type].icon" />
          <input v-model="newCat[g.type].name" class="input" maxlength="40" placeholder="Nama kategori baru..." required />
          <button class="btn btn-primary btn-sm"><Icon name="mingcute:add-line" /> Tambah</button>
        </form>

        <ul class="cat-list">
          <li v-for="c in catsOf(g.type)" :key="c.id" class="cat-item" :class="{ editing: editing.id === c.id }">
            <template v-if="editing.id === c.id">
              <IconPicker v-model="editing.icon" />
              <input v-model="editing.name" class="input" maxlength="40" @keydown.enter.prevent="saveEdit" @keydown.esc="editing.id = 0" />
              <button class="icon-btn" title="Simpan" @click="saveEdit"><Icon name="mingcute:check-line" /></button>
              <button class="icon-btn" title="Batal" @click="editing.id = 0"><Icon name="mingcute:close-line" /></button>
            </template>
            <template v-else>
              <CatIcon :icon="c.icon" />
              <span class="cat-name">{{ c.name }}</span>
              <span class="cat-count">{{ c.used }} transaksi</span>
              <button class="icon-btn" title="Edit" @click="startEdit(c)"><Icon name="mingcute:edit-2-line" /></button>
              <button class="icon-btn" title="Hapus" :disabled="catsOf(g.type).length <= 1" @click="remove(c)"><Icon name="mingcute:delete-2-line" /></button>
            </template>
          </li>
        </ul>
      </section>
    </div>

    <p class="page-sub" style="text-align: center; margin-top: 20px; font-size: 0.86rem">
      <Icon name="mingcute:bulb-line" class="inline-ic" /> Nama kategori ini juga yang nanti dipakai bot Telegram untuk mengelompokkan transaksimu.
    </p>

    <div v-if="moving.cat" class="modal" @click.self="moving.cat = null">
      <div class="modal-box">
        <span class="modal-ic tone-blush"><Icon name="mingcute:box-3-line" /></span>
        <h3>Pindahkan transaksi</h3>
        <p>Kategori <b>{{ moving.cat.name }}</b> dipakai di <b>{{ moving.cat.used }}</b> transaksi. Pindahkan ke:</p>
        <label class="field">
          <select v-model.number="moving.target">
            <option v-for="c in catsOf(moving.cat.type).filter((x) => x.id !== moving.cat!.id)" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </label>
        <div class="actions">
          <button class="btn btn-danger" @click="confirmMove">Pindahkan & hapus</button>
          <button class="btn btn-ghost" @click="moving.cat = null">Batal</button>
        </div>
      </div>
    </div>
  </div>
</template>
