<template>
  <p class="brand-mark" aria-hidden="true">tolos</p>
</template>

<style scoped>
.brand-mark {
  margin: 0;
  font-family: var(--font-brand);
  font-size: var(--type-brand-size);
  font-weight: var(--type-brand-weight);
  line-height: var(--type-brand-line);
  letter-spacing: var(--type-brand-tracking);
  color: var(--color-on-surface);
  text-transform: lowercase;
}

@media (max-width: 720px) {
  .brand-mark {
    font-size: var(--type-brand-sm-size);
    font-weight: var(--type-brand-sm-weight);
    line-height: var(--type-brand-sm-line);
    letter-spacing: var(--type-brand-sm-tracking);
  }
}
</style>
