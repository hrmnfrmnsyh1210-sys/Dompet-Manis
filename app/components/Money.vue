<script setup lang="ts">
// Angka rupiah bergaya: "Rp" kecil, angka tebal, 3 digit terakhir tipis
const props = defineProps<{ value: number; signed?: "in" | "out" | "auto" }>();
const parts = computed(() => moneyParts(props.value));
const sign = computed(() => {
  if (props.signed === "in") return "+";
  if (props.signed === "out") return "-";
  return props.value < 0 ? "-" : "";
});
</script>

<template>
  <span class="money">{{ sign }}<span class="cur">Rp</span>{{ parts.head }}<span class="tail">{{ parts.tail }}</span></span>
</template>
