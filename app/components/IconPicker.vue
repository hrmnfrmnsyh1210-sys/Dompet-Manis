<script setup lang="ts">
const model = defineModel<string>({ required: true });
const open = ref(false);
const root = ref<HTMLElement>();

function pick(k: string) {
  model.value = k;
  open.value = false;
}

function onDocClick(e: MouseEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false;
}
onMounted(() => document.addEventListener("click", onDocClick));
onBeforeUnmount(() => document.removeEventListener("click", onDocClick));
</script>

<template>
  <div ref="root" class="icon-pick-wrap">
    <button type="button" class="icon-pick-btn" title="Pilih ikon" @click="open = !open">
      <CatIcon :icon="model" size="sm" />
    </button>
    <div v-if="open" class="icon-pop">
      <button v-for="k in ICON_KEYS" :key="k" type="button" :class="{ on: k === model }" :title="k" @click="pick(k)">
        <CatIcon :icon="k" size="sm" />
      </button>
    </div>
  </div>
</template>
