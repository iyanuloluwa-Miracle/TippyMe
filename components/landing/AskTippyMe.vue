<template>
  <div class="ask-tippy-me">
    <Transition name="ask-chat">
      <section
        v-if="isOpen"
        id="ask-tippy-me-panel"
        class="ask-tippy-me__panel"
        aria-label="Ask TippyMe assistant"
      >
        <header class="ask-tippy-me__header">
          <div class="ask-tippy-me__avatar" aria-hidden="true">🎲</div>
          <div>
            <p class="ask-tippy-me__eyebrow">TippyMe assistant</p>
            <h2>How can we help?</h2>
          </div>
          <button class="ask-tippy-me__close" type="button" aria-label="Close assistant" @click="isOpen = false">×</button>
        </header>

        <div class="ask-tippy-me__messages" aria-live="polite">
          <p class="ask-tippy-me__message">Hi! Ask me anything about receiving support with TippyMe.</p>
          <p v-if="answer" class="ask-tippy-me__message ask-tippy-me__message--answer">{{ answer }}</p>
        </div>

        <div class="ask-tippy-me__suggestions">
          <button v-for="prompt in prompts" :key="prompt.question" type="button" @click="answer = prompt.answer">
            {{ prompt.question }}
          </button>
        </div>

        <form class="ask-tippy-me__form" @submit.prevent="submitQuestion">
          <label class="sr-only" for="ask-tippy-me-input">Your question</label>
          <input id="ask-tippy-me-input" v-model="question" type="text" placeholder="Type your question…" autocomplete="off" />
          <button type="submit" aria-label="Send question">↑</button>
        </form>
      </section>
    </Transition>

    <button
      class="ask-tippy-me__trigger"
      type="button"
      :aria-expanded="isOpen"
      aria-controls="ask-tippy-me-panel"
      @click="isOpen = !isOpen"
    >
      <span class="ask-tippy-me__sparkle" aria-hidden="true">
        <svg class="ask-tippy-me__dice" viewBox="0 0 28 28" fill="none">
          <rect x="4" y="4" width="20" height="20" rx="5" fill="currentColor" />
          <g fill="#ceff83">
            <circle cx="10" cy="10" r="1.6" /><circle cx="18" cy="10" r="1.6" />
            <circle cx="14" cy="14" r="1.6" />
            <circle cx="10" cy="18" r="1.6" /><circle cx="18" cy="18" r="1.6" />
          </g>
        </svg>
        <span class="ask-tippy-me__twinkle">✦</span>
      </span>
      <span class="ask-tippy-me__trigger-label">{{ isOpen ? 'Close assistant' : 'Ask TippyMe' }}</span>
      <svg class="ask-tippy-me__arrow" :class="{ 'is-open': isOpen }" aria-hidden="true" viewBox="0 0 20 20" fill="none">
        <path d="m6 14 8-8M6 6h8v8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
const isOpen = ref(false);
const question = ref('');
const answer = ref('');

const prompts = [
  { question: 'How does TippyMe work?', answer: 'Create your page, share one link, and supporters can send you money and a message in a few simple steps.' },
  { question: 'Do supporters need an account?', answer: 'No. Your supporters can send support without creating a TippyMe account.' },
  { question: 'How do I get started?', answer: 'Choose “Get started” to create your TippyMe page and begin sharing your link.' },
];

function submitQuestion() {
  const value = question.value.trim();
  if (!value) return;

  answer.value = 'Thanks for asking! Our support team can help with that. You can also explore the FAQs below for quick answers.';
  question.value = '';
}
</script>

<style scoped>
.ask-tippy-me { position: fixed; right: 1.25rem; bottom: 1.25rem; z-index: 50; display: flex; flex-direction: column; align-items: flex-end; gap: .75rem; font-family: inherit; }
.ask-tippy-me__trigger {
  display: inline-flex;
  align-items: center;
  gap: .7rem;
  min-height: 3.65rem;
  padding: .45rem 1rem .45rem .45rem;
  color: #fff;
  background: linear-gradient(135deg, #58309b 0%, #3b1d7a 60%, #30145f 100%);
  border: 1px solid #ffffff40;
  border-radius: 9999px;
  box-shadow: 0 0 0 4px #9362ff0d, 0 7px 24px #3b1d7a30, inset 0 1px 0 #ffffff20;
  transition: transform .2s ease, box-shadow .2s ease;
}
.ask-tippy-me__trigger:hover {
  transform: translateY(-3px);
  box-shadow: 0 0 0 5px #9362ff12, 0 12px 30px #3b1d7a40, inset 0 1px 0 #ffffff25;
}
.ask-tippy-me__trigger:active { transform: translateY(0) scale(.98); }
.ask-tippy-me__trigger:focus-visible { outline: 3px solid #9362ff; outline-offset: 5px; }
.ask-tippy-me__trigger-label { font-size: 1rem; font-weight: 800; letter-spacing: -.01em; white-space: nowrap; }
.ask-tippy-me__sparkle, .ask-tippy-me__avatar {
  position: relative;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 2.65rem;
  height: 2.65rem;
  color: #3b1d7a;
  font-size: 1.4rem;
  background: linear-gradient(145deg, #e0ffa7, #bcf56a);
  border: 1px solid #e5ffb9;
  border-radius: 9999px;
  box-shadow: inset 0 1px 2px #ffffff80, 0 2px 6px #190b3b25;
}
.ask-tippy-me__dice { width: 1.9rem; height: 1.9rem; transform: rotate(-12deg); transition: transform .3s ease; }
.ask-tippy-me__trigger:hover .ask-tippy-me__dice, .ask-tippy-me__trigger:focus-visible .ask-tippy-me__dice { transform: rotate(12deg); }
.ask-tippy-me__twinkle { position: absolute; top: -.2rem; right: -.12rem; color: #e0ffa7; font-size: .85rem; text-shadow: 0 1px 2px #3b1d7a; }
.ask-tippy-me__arrow { width: 1rem; height: 1rem; margin-left: .1rem; color: #ceff83; transition: transform .2s ease; }
.ask-tippy-me__arrow.is-open { transform: rotate(180deg); }
.ask-tippy-me__panel { width: min(23rem, calc(100vw - 2.5rem)); overflow: hidden; background: white; border: 1px solid #e7ddff; border-radius: 1.25rem; box-shadow: 0 18px 50px rgba(36,18,79,.2); }
.ask-tippy-me__header { display: flex; align-items: center; gap: .7rem; padding: 1rem; color: white; background: linear-gradient(135deg, #58309b, #30145f); }
.ask-tippy-me__header h2, .ask-tippy-me__eyebrow { margin: 0; }
.ask-tippy-me__header h2 { font-size: 1.1rem; line-height: 1.1; }
.ask-tippy-me__eyebrow { margin-bottom: .15rem; font-size: .72rem; opacity: .76; }
.ask-tippy-me__avatar { flex: 0 0 auto; }
.ask-tippy-me__close { margin-left: auto; color: white; font-size: 1.7rem; line-height: 1; background: transparent; border: 0; }
.ask-tippy-me__messages { display: grid; gap: .65rem; min-height: 6.5rem; padding: 1rem; background: #fbfaff; }
.ask-tippy-me__message { width: fit-content; max-width: 90%; margin: 0; padding: .7rem .85rem; font-size: .92rem; line-height: 1.35; background: #eee6ff; border-radius: .2rem .8rem .8rem .8rem; }
.ask-tippy-me__message--answer { margin-left: auto; color: white; background: #5b2db8; border-radius: .8rem .2rem .8rem .8rem; }
.ask-tippy-me__suggestions { display: flex; flex-wrap: wrap; gap: .45rem; padding: 0 1rem 1rem; }
.ask-tippy-me__suggestions button { padding: .38rem .62rem; color: #5b2db8; font-size: .78rem; background: white; border: 1px solid #d9cbff; border-radius: 9999px; }
.ask-tippy-me__suggestions button:hover { background: #eee6ff; }
.ask-tippy-me__form { display: flex; gap: .45rem; padding: .75rem; border-top: 1px solid #eee6ff; }
.ask-tippy-me__form input { min-width: 0; flex: 1; padding: .65rem .75rem; color: #1a1228; border: 1px solid #d9cbff; border-radius: .65rem; outline-color: #9362ff; }
.ask-tippy-me__form button { width: 2.45rem; color: #3b1d7a; font-size: 1.2rem; background: #ceff83; border: 1px solid #b5e76e; border-radius: .65rem; }
.ask-chat-enter-active, .ask-chat-leave-active { transition: opacity .18s ease, transform .18s ease; }
.ask-chat-enter-from, .ask-chat-leave-to { opacity: 0; transform: translateY(.5rem) scale(.98); }
@media (max-width: 640px) { .ask-tippy-me { right: .8rem; bottom: .8rem; } .ask-tippy-me__trigger { min-height: 3rem; } }
@media (prefers-reduced-motion: reduce) {
  .ask-tippy-me__trigger, .ask-tippy-me__dice, .ask-tippy-me__arrow,
  .ask-chat-enter-active, .ask-chat-leave-active { transition: none; }
  .ask-tippy-me__trigger:hover, .ask-tippy-me__trigger:active { transform: none; }
}
</style>
