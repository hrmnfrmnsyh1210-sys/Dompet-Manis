<script setup lang="ts">
// Ikon kategori di dalam bulatan pastel
const props = withDefaults(defineProps<{ icon: string; size?: "sm" | "md" | "lg" }>(), { size: "md" });
const tone = computed(() => toneOf(props.icon));
</script>

<template>
  <span class="cat-ic" :class="[`tone-${tone}`, `size-${size}`]">
    <Icon :name="iconName(icon)" />
  </span>
</template>
