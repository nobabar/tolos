<script setup lang="ts">
/** Reserved control column for dial, seed, and action controls. */
</script>

<template>
  <aside class="control-rail" aria-hidden="true" />
</template>

<style scoped>
.control-rail {
  min-height: 12rem;
  width: 100%;
  max-width: 220px;
  padding-top: calc(var(--type-brand-size) * var(--type-brand-line) + var(--space-5));
}

@media (max-width: 720px) {
  .control-rail {
    max-width: none;
    min-height: 4rem;
    padding-top: 0;
  }
}
</style>
