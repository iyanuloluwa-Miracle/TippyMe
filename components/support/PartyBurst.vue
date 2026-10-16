<template>
  <div
    v-if="active"
    class="party"
    aria-hidden="true"
  >
    <span
      v-for="piece in pieces"
      :key="piece.id"
      class="party__piece"
      :class="piece.kind"
      :style="piece.style"
    />
  </div>
</template>

<script setup lang="ts">
interface Piece {
  id: number;
  kind: 'fall' | 'burst';
  style: Record<string, string>;
}

const COLORS = ['#9362ff', '#c4a0ff', '#ffb454', '#ff7a9c', '#3dbe8b', '#ffe56b', '#ffffff'];

const active = ref(false);
const pieces = ref<Piece[]>([]);
let clearTimer: ReturnType<typeof setTimeout> | null = null;

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function buildPieces(): Piece[] {
  const falling: Piece[] = Array.from({ length: 46 }, (_, id) => ({
    id,
    kind: 'fall',
    style: {
      '--x': `${rand(0, 100)}%`,
      '--drift': `${rand(-80, 80)}px`,
      '--rot': `${rand(180, 720)}deg`,
      '--d': `${rand(2.4, 4.2)}s`,
      '--delay': `${rand(0, 0.45)}s`,
      '--c': COLORS[id % COLORS.length]!,
      '--w': `${rand(7, 12)}px`,
      '--h': `${rand(8, 16)}px`,
      '--radius': Math.random() > 0.55 ? '999px' : '2px',
    },
  }));

  const burst: Piece[] = Array.from({ length: 22 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 22 + rand(-0.2, 0.2);
    const distance = rand(90, 220);
    return {
      id: 100 + index,
      kind: 'burst',
      style: {
        '--dx': `${Math.cos(angle) * distance}px`,
        '--dy': `${Math.sin(angle) * distance - 40}px`,
        '--rot': `${rand(-180, 180)}deg`,
        '--d': `${rand(0.9, 1.35)}s`,
        '--c': COLORS[index % COLORS.length]!,
        '--w': `${rand(8, 13)}px`,
        '--h': `${rand(8, 13)}px`,
        '--radius': Math.random() > 0.4 ? '999px' : '3px',
      },
    };
  });

  return [...burst, ...falling];
}

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  pieces.value = buildPieces();
  active.value = true;
  clearTimer = setTimeout(() => {
    active.value = false;
  }, 4600);
});

onBeforeUnmount(() => {
  if (clearTimer) clearTimeout(clearTimer);
});
</script>

<style scoped>
.party {
  position: fixed;
  inset: 0;
  z-index: 30;
  overflow: hidden;
  pointer-events: none;
}
.party__piece {
  position: absolute;
  width: var(--w);
  height: var(--h);
  background: var(--c);
  border-radius: var(--radius);
}
.party__piece.fall {
  top: -20px;
  left: var(--x);
  animation: party-fall var(--d) var(--delay) linear forwards;
}
.party__piece.burst {
  top: 28%;
  left: 50%;
  animation: party-burst var(--d) cubic-bezier(.16, .84, .32, 1) forwards;
}
@keyframes party-fall {
  0% { transform: translate3d(0, -8vh, 0) rotate(0deg); opacity: 1; }
  80% { opacity: 1; }
  100% { transform: translate3d(var(--drift), 108vh, 0) rotate(var(--rot)); opacity: 0; }
}
@keyframes party-burst {
  0% { transform: translate(-50%, -50%) scale(0.3) rotate(0deg); opacity: 0; }
  12% { opacity: 1; }
  100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1) rotate(var(--rot)); opacity: 0; }
}
</style>
