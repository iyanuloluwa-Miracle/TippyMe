<template>
  <section
    class="support-heatmap"
    aria-labelledby="support-heatmap-heading"
  >
    <header class="support-heatmap__header">
      <p class="support-heatmap__kicker">WALL OF LOVE</p>
      <h2 id="support-heatmap-heading">Support over time</h2>
    </header>
    <p
      v-if="total === 0"
      class="support-heatmap__empty"
    >
      No tips in this stretch yet. They’ll fill in here.
    </p>
    <div class="support-heatmap__scroll">
      <div
        class="support-heatmap__grid"
        role="img"
        :aria-label="ariaLabel"
      >
        <span
          v-for="(day, index) in cells"
          :key="day ? day.date : `pad-${index}`"
          class="support-heatmap__cell"
          :data-level="day ? levelFor(day.count) : 'pad'"
          :title="day ? tipTitle(day) : undefined"
        />
      </div>
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

/** Pad the front so each column is a Sunday–Saturday week. */
const cells = computed(() => {
  const days = props.days;
  if (!days.length) return [] as (SupportActivityDay | null)[];
  const first = new Date(`${days[0]!.date}T00:00:00Z`);
  const lead = Number.isNaN(first.getTime()) ? 0 : first.getUTCDay();
  const padded: (SupportActivityDay | null)[] = Array.from({ length: lead }, () => null);
  return padded.concat(days);
});

function levelFor(count: number) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  return 3;
}

function tipTitle(day: SupportActivityDay) {
  return `${day.date}: ${day.count} tip${day.count === 1 ? '' : 's'}`;
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
.support-heatmap__empty {
  margin: -4px 0 12px;
  color: var(--page-muted, #6d5b82);
  font-size: 13px;
  line-height: 1.4;
}
.support-heatmap__scroll {
  overflow-x: auto;
  padding-bottom: 2px;
}
.support-heatmap__grid {
  display: grid;
  grid-template-rows: repeat(7, 12px);
  grid-auto-flow: column;
  grid-auto-columns: 12px;
  gap: 4px;
  width: max-content;
}
.support-heatmap__cell {
  display: block;
  width: 12px;
  height: 12px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--page-accent, #7c4ac0) 22%, var(--page-surface, #fff));
}
.support-heatmap__cell[data-level='pad'] {
  background: transparent;
}
.support-heatmap__cell[data-level='1'] {
  background: color-mix(in srgb, var(--page-accent, #7c4ac0) 48%, var(--page-surface, #fff));
}
.support-heatmap__cell[data-level='2'] {
  background: color-mix(in srgb, var(--page-accent, #7c4ac0) 74%, var(--page-surface, #fff));
}
.support-heatmap__cell[data-level='3'] {
  background: var(--page-accent, #7c4ac0);
}
.support-heatmap__legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 14px;
  color: var(--page-muted, #6d5b82);
  font-size: 12px;
  line-height: 1;
}
.support-heatmap__legend .support-heatmap__cell {
  width: 12px;
  height: 12px;
  flex: 0 0 auto;
}
</style>
