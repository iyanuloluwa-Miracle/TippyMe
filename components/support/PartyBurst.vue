<template>
  <Teleport to="body">
    <div
      v-if="active"
      class="party"
      aria-hidden="true"
    >
      <span
        v-for="piece in pieces"
        :key="piece.id"
        class="party__piece"
        :class="[piece.kind, { 'is-on': playing }]"
        :style="piece.style"
      />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
interface Piece {
  id: number;
  kind: 'fall' | 'burst';
  style: Record<string, string>;
}

const COLORS = ['#9362ff', '#c4a0ff', '#ffb454', '#ff7a9c', '#3dbe8b', '#ffe56b', '#ffffff'];

const active = ref(false);
const playing = ref(false);
const pieces = ref<Piece[]>([]);
let clearTimer: ReturnType<typeof setTimeout> | null = null;
let frame = 0;

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function pieceLook(color: string, width: number, height: number, radius: string) {
  return {
    width: `${width}px`,
    height: `${height}px`,
    backgroundColor: color,
    borderRadius: radius,
  };
}

function buildPieces(): Piece[] {
  const falling: Piece[] = Array.from({ length: 46 }, (_, id) => ({
    id,
    kind: 'fall',
    style: {
      ...pieceLook(
        COLORS[id % COLORS.length]!,
        rand(7, 12),
        rand(8, 16),
        Math.random() > 0.55 ? '999px' : '2px',
      ),
      '--x': `${rand(0, 100)}%`,
      '--drift': `${rand(-80, 80)}px`,
      '--rot': `${rand(180, 720)}deg`,
      '--d': `${rand(2.4, 4.2)}s`,
      '--delay': `${rand(0, 0.45)}s`,
    },
  }));

  const burst: Piece[] = Array.from({ length: 22 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 22 + rand(-0.2, 0.2);
    const distance = rand(90, 220);
    return {
      id: 100 + index,
      kind: 'burst',
      style: {
        ...pieceLook(
          COLORS[index % COLORS.length]!,
          rand(8, 13),
          rand(8, 13),
          Math.random() > 0.4 ? '999px' : '3px',
        ),
        '--dx': `${Math.cos(angle) * distance}px`,
        '--dy': `${Math.sin(angle) * distance - 40}px`,
        '--rot': `${rand(-180, 180)}deg`,
        '--d': `${rand(0.9, 1.35)}s`,
      },
    };
  });

  return [...burst, ...falling];
}

onMounted(async () => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  pieces.value = buildPieces();
  active.value = true;
  await nextTick();
  // Paint the pieces once before starting motion. If the animation class
  // is on the first frame, the burst can finish at opacity 0 before it is seen.
  frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame(() => {
      playing.value = true;
    });
  });
  clearTimer = setTimeout(() => {
    active.value = false;
    playing.value = false;
  }, 4800);
});

onBeforeUnmount(() => {
  if (frame) cancelAnimationFrame(frame);
  if (clearTimer) clearTimeout(clearTimer);
});
</script>

<style scoped>
.party {
  position: fixed;
  inset: 0;
  z-index: 80;
  overflow: hidden;
  pointer-events: none;
}
.party__piece {
  position: absolute;
  display: block;
}
.party__piece.fall {
  top: -20px;
  left: var(--x);
}
.party__piece.burst {
  top: 28%;
  left: 50%;
}
.party__piece.fall.is-on {
  animation-name: party-fall;
  animation-duration: var(--d);
  animation-delay: var(--delay);
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}
.party__piece.burst.is-on {
  animation-name: party-burst;
  animation-duration: var(--d);
  animation-timing-function: cubic-bezier(0.16, 0.84, 0.32, 1);
  animation-fill-mode: forwards;
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
