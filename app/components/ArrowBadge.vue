<script setup lang="ts">
defineProps<{ type: "in" | "out" }>();
</script>

<template>
  <span class="arrow" :class="type" :title="type === 'in' ? 'Pemasukan' : 'Pengeluaran'">
    <Icon :name="type === 'in' ? 'mingcute:arrow-right-line' : 'mingcute:arrow-left-line'" />
  </span>
</template>
