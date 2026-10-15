<template>
  <section
    class="support-heatmap"
    aria-labelledby="support-heatmap-heading"
  >
    <header class="support-heatmap__header">
      <p class="support-heatmap__kicker">WALL OF LOVE</p>
      <h2 id="support-heatmap-heading">Support over time</h2>
    </header>
    <div
      class="support-heatmap__grid"
      role="img"
      :aria-label="ariaLabel"
    >
      <span
        v-for="day in days"
        :key="day.date"
        class="support-heatmap__cell"
        :data-level="levelFor(day.count)"
        :title="`${day.date}: ${day.count} tip${day.count === 1 ? '' : 's'}`"
      />
    </div>
    <footer class="support-heatmap__legend">
      <span>Less</span>
      <span
        class="support-heatmap__cell"
        data-level="0"
        aria-hidden="true"
      />
      <span
        class="support-heatmap__cell"
        data-level="1"
        aria-hidden="true"
      />
      <span
        class="support-heatmap__cell"
        data-level="2"
        aria-hidden="true"
      />
      <span
        class="support-heatmap__cell"
        data-level="3"
        aria-hidden="true"
      />
      <span>More</span>
    </footer>
  </section>
</template>

<script setup lang="ts">
import type { SupportActivityDay } from '~/types/api';

const props = defineProps<{
  days: SupportActivityDay[];
}>();

const total = computed(() =>
  props.days.reduce((sum, day) => sum + day.count, 0),
);

const ariaLabel = computed(
  () =>
    `Support activity for the last ${props.days.length} days. ${total.value} tip${total.value === 1 ? '' : 's'} total.`,
);

function levelFor(count: number) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  return 3;
}
</script>

<style scoped>
.support-heatmap {
  padding: 20px;
  border: 1px solid var(--page-border, #e7dfee);
  border-radius: 20px;
  background: var(--page-surface, #fff);
  box-shadow: 0 10px 28px #00000008;
}
.support-heatmap__header { margin-bottom: 14px; }
.support-heatmap__kicker {
  margin: 0;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .14em;
  color: var(--page-kicker, #6d3db0);
}
.support-heatmap__header h2 {
  margin: 6px 0 0;
  font-family: var(--page-font-display, inherit);
  font-size: 18px;
  letter-spacing: -.02em;
  color: var(--page-ink, #261b38);
}
.support-heatmap__grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  grid-auto-rows: 12px;
  gap: 4px;
}
.support-heatmap__cell {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 3px;
  background: color-mix(in srgb, var(--page-accent, #7c4ac0) 10%, transparent);
}
.support-heatmap__cell[data-level='1'] {
  background: color-mix(in srgb, var(--page-accent, #7c4ac0) 35%, transparent);
}
.support-heatmap__cell[data-level='2'] {
  background: color-mix(in srgb, var(--page-accent, #7c4ac0) 62%, transparent);
}
.support-heatmap__cell[data-level='3'] {
  background: var(--page-accent, #7c4ac0);
}
.support-heatmap__legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 12px;
  color: var(--page-muted, #6d5b82);
  font-size: 11px;
}
.support-heatmap__legend .support-heatmap__cell {
  width: 10px;
  height: 10px;
  flex: 0 0 auto;
}
@media (max-width: 520px) {
  .support-heatmap__grid { grid-template-columns: repeat(7, minmax(0, 1fr)); }
}
</style>
