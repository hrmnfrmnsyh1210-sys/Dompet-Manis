<script setup lang="ts">
const { toast } = useToast();
</script>

<template>
  <div class="toast" :class="{ show: toast.show, error: toast.error }" role="status" aria-live="polite">
    <Icon :name="toast.error ? 'mingcute:sad-line' : 'mingcute:check-circle-line'" class="toast-ic" />
    {{ toast.msg }}
  </div>
</template>
