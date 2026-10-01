<template>
  <div class="ask-tippy-me" @keydown.esc="closeChat">
    <Transition name="ask-chat">
      <section
        v-if="isOpen"
        id="ask-tippy-me-panel"
        class="ask-tippy-me__panel"
        aria-label="Ask TippyMe assistant"
        role="dialog"
      >
        <header class="ask-tippy-me__header">
          <div class="ask-tippy-me__avatar" aria-hidden="true">🎲</div>
          <div>
            <p class="ask-tippy-me__eyebrow">{{ dashboard ? 'Your creator assistant' : 'TippyMe assistant' }}</p>
            <h2>{{ dashboard && displayName ? `Hi, ${displayName}` : 'How can we help?' }}</h2>
          </div>
          <button class="ask-tippy-me__close" type="button" aria-label="Close assistant" @click="closeChat">×</button>
        </header>

        <div v-if="dashboard" class="ask-tippy-me__context">
          <span>✦ Your account, explained</span>
          <button type="button" :disabled="pending" @click="clearChat">New chat</button>
        </div>
        <div ref="messageList" class="ask-tippy-me__messages" role="log" aria-label="Conversation" aria-live="polite" :aria-busy="pending">
          <p class="ask-tippy-me__message">{{ dashboard ? 'Let’s make sense of your creator account. Ask about your payout setup, Friday payouts, support, or goals.' : 'Hi! Ask me about receiving support with TippyMe.' }}</p>
          <div v-for="(message, index) in messages" :key="index" class="ask-tippy-me__entry" :class="{ 'ask-tippy-me__entry--user': message.role === 'user' }">
            <span class="ask-tippy-me__speaker">{{ message.role === 'user' ? 'You' : 'TippyMe' }}</span>
            <p class="ask-tippy-me__message" :class="{ 'ask-tippy-me__message--user': message.role === 'user' }">{{ message.text }}</p>
            <div v-if="message.actions?.length" class="ask-tippy-me__actions">
              <NuxtLink v-for="action in message.actions" :key="action.to" :to="action.to" @click="closeChat">{{ action.label }} ↗</NuxtLink>
            </div>
            <small v-if="message.checkedAt" class="ask-tippy-me__checked">Account records checked at {{ formatTime(message.checkedAt) }}</small>
          </div>
          <p v-if="pending" class="ask-tippy-me__thinking">Checking your account…</p>
        </div>
        <div class="ask-tippy-me__suggestions">
          <button v-for="prompt in suggestions" :key="prompt" type="button" :disabled="pending" @click="submitQuestion(prompt)">
            {{ prompt }}
          </button>
        </div>
        <p v-if="error" class="ask-tippy-me__error" role="alert">{{ error }} <button v-if="failedQuestion" type="button" :disabled="pending" @click="submitQuestion(failedQuestion, true)">Try again</button></p>
        <form class="ask-tippy-me__form" @submit.prevent="submitQuestion()">
          <label class="sr-only" for="ask-tippy-me-input">Your question</label>
          <input id="ask-tippy-me-input" ref="questionInput" v-model="question" type="text" :placeholder="dashboard ? 'Ask about your payouts…' : 'Type your question…'" maxlength="1000" autocomplete="off" />
          <button type="submit" aria-label="Send question" :disabled="pending || !question.trim()">↑</button>
        </form>
        <p v-if="dashboard" class="ask-tippy-me__footnote">Answers use your TippyMe records. Bank transfer details stay with Bachs.</p>
      </section>
    </Transition>

    <button
      class="ask-tippy-me__trigger"
      ref="trigger"
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
import type { AssistantReply, AssistantTopic } from '~/types/assistant';
import { ApiClientError } from '~/services/api';

const props = withDefaults(defineProps<{ dashboard?: boolean }>(), { dashboard: false });
const api = useApi();
const isOpen = ref(false);
const question = ref('');
const displayName = ref('');
const pending = ref(false);
const error = ref('');
const failedQuestion = ref('');
const topic = ref<AssistantTopic>();
const questionInput = ref<HTMLInputElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const messageList = ref<HTMLElement | null>(null);
const messages = ref<{ role: 'user' | 'assistant'; text: string; actions?: AssistantReply['actions']; checkedAt?: string }[]>([]);
let disposed = false;
onUnmounted(() => { disposed = true; });

const prompts = [
  { question: 'How does TippyMe work?', answer: 'Create your page, share one link, and supporters can send you money and a message in a few simple steps.' },
  { question: 'Do supporters need an account?', answer: 'No. Your supporters can send support without creating a TippyMe account.' },
  { question: 'How do I get started?', answer: 'Choose “Get started” to create your TippyMe page and begin sharing your link.' },
];

const suggestions = computed(() => props.dashboard
  ? ['Is my payout setup complete?', 'When are my Friday payouts?', 'How much support have I received?']
  : prompts.map((prompt) => prompt.question));

watch(isOpen, async (open) => {
  if (!open) return;
  await nextTick();
  questionInput.value?.focus();
  await scrollMessages();
  if (props.dashboard && !displayName.value) {
    try {
      const { profile } = await api.getMyCreator();
      if (!disposed) displayName.value = profile?.displayName || '';
    } catch { /* Asking a question provides a visible, retryable account error. */ }
  }
});

function closeChat() { isOpen.value = false; trigger.value?.focus(); }
function clearChat() {
  messages.value = []; topic.value = undefined; error.value = ''; failedQuestion.value = ''; question.value = '';
  questionInput.value?.focus();
}
function formatTime(value: string) { return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
async function scrollMessages() {
  await nextTick();
  if (messageList.value) messageList.value.scrollTop = messageList.value.scrollHeight;
}

async function submitQuestion(suggestion?: string, retry = false) {
  const value = (suggestion ?? question.value).trim();
  if (!value || pending.value) return;
  error.value = ''; failedQuestion.value = ''; pending.value = true;
  if (!retry) messages.value.push({ role: 'user', text: value });
  messages.value = messages.value.slice(-40);
  if (!suggestion) question.value = '';
  await scrollMessages();
  try {
    if (props.dashboard) {
      const reply = await api.askDashboardAssistant(value, topic.value);
      if (disposed) return;
      displayName.value = reply.displayName;
      topic.value = reply.topic;
      messages.value.push({ role: 'assistant', text: reply.answer, actions: reply.actions, checkedAt: reply.checkedAt });
    } else {
      const q = value.toLowerCase();
      const match = prompts.find((prompt) => prompt.question === value)
        ?? (/account/.test(q) ? prompts[1] : /start|sign up|signup/.test(q) ? prompts[2] : /work|tippyme/.test(q) ? prompts[0] : undefined);
      messages.value.push({ role: 'assistant', text: match?.answer ?? 'For questions about your personal payouts or support, sign in and ask me from your dashboard. For general questions, explore the FAQs below.', actions: match ? undefined : [{ label: 'Sign in to your dashboard', to: '/login' }] });
    }
  } catch (err) {
    if (disposed) return;
    failedQuestion.value = value;
    error.value = err instanceof ApiClientError && err.statusCode === 401
      ? 'Your session has expired. Sign in again to ask about your account.'
      : err instanceof ApiClientError && err.statusCode === 429
        ? 'You’ve sent several questions. Please wait a minute and try again.'
        : 'I couldn’t read your account right now. Please try again.';
  } finally {
    if (!disposed) { pending.value = false; await scrollMessages(); }
  }
}
</script>

<style scoped>
.ask-tippy-me { position: fixed; right: 1.25rem; bottom: max(1.25rem, env(safe-area-inset-bottom)); z-index: 40; display: flex; flex-direction: column; align-items: flex-end; gap: .75rem; font-family: inherit; }
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
.ask-tippy-me__panel { display: flex; flex-direction: column; width: min(26rem, calc(100vw - 2.5rem)); max-height: calc(100dvh - 7rem - env(safe-area-inset-bottom)); overflow: hidden; background: white; border: 1px solid #e7ddff; border-radius: 1.25rem; box-shadow: 0 18px 50px rgba(36,18,79,.2); }
.ask-tippy-me__header { display: flex; align-items: center; gap: .7rem; padding: 1rem; color: white; background: linear-gradient(135deg, #58309b, #30145f); }
.ask-tippy-me__header h2, .ask-tippy-me__eyebrow { margin: 0; }
.ask-tippy-me__header h2 { font-size: 1.1rem; line-height: 1.1; overflow-wrap: anywhere; }
.ask-tippy-me__header > div:nth-child(2) { min-width: 0; }
.ask-tippy-me__header, .ask-tippy-me__form, .ask-tippy-me__suggestions { flex-shrink: 0; }
.ask-tippy-me__eyebrow { margin-bottom: .15rem; font-size: .72rem; opacity: .76; }
.ask-tippy-me__avatar { flex: 0 0 auto; }
.ask-tippy-me__close { margin-left: auto; color: white; font-size: 1.7rem; line-height: 1; background: transparent; border: 0; }
.ask-tippy-me__messages { display: flex; flex-direction: column; gap: .85rem; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 1rem; background: #fbfaff; }
.ask-tippy-me__message { width: fit-content; max-width: 90%; margin: 0; padding: .7rem .85rem; font-size: .92rem; line-height: 1.35; background: #eee6ff; border-radius: .2rem .8rem .8rem .8rem; }
.ask-tippy-me__message { white-space: pre-wrap; overflow-wrap: anywhere; }
.ask-tippy-me__message--user { margin-left: auto; color: white; background: #5b2db8; border-radius: .8rem .2rem .8rem .8rem; }
.ask-tippy-me__entry--user { text-align: right; }
.ask-tippy-me__entry--user p { text-align: left; }
.ask-tippy-me__speaker { display: block; margin: 0 .2rem .25rem; font-size: .72rem; color: #756484; }
.ask-tippy-me__context { display: flex; flex-shrink: 0; justify-content: space-between; gap: .5rem; padding: .6rem 1rem; color: #695183; background: #f4eefc; font-size: .75rem; }
.ask-tippy-me__context button { text-decoration: underline; }
.ask-tippy-me__actions { display: flex; flex-wrap: wrap; gap: .4rem; margin-top: .5rem; }
.ask-tippy-me__actions a { border: 1px solid #d9cbff; padding: .45rem .7rem; border-radius: .6rem; background: white; color: #5b2db8; font-size: .8rem; }
.ask-tippy-me__checked { display: block; margin: .4rem .2rem 0; color: #806e92; font-size: .67rem; }
.ask-tippy-me__thinking { margin: 0; font-size: .85rem; color: #705090; }
.ask-tippy-me__error { margin: 0; padding: .6rem 1rem; font-size: .8rem; color: #9c3045; background: #fff2f4; }
.ask-tippy-me__error button { text-decoration: underline; }
.ask-tippy-me__footnote { flex-shrink: 0; margin: 0; padding: 0 1rem .75rem; font-size: .67rem; line-height: 1.3; color: #806e92; }
.ask-tippy-me button:disabled { cursor: not-allowed; opacity: .5; }
.ask-tippy-me button:focus-visible, .ask-tippy-me a:focus-visible { outline: 2px solid #9362ff; outline-offset: 2px; }
.ask-tippy-me__suggestions { display: flex; flex-wrap: wrap; gap: .45rem; padding: 0 1rem 1rem; }
.ask-tippy-me__suggestions button { padding: .38rem .62rem; color: #5b2db8; font-size: .78rem; background: white; border: 1px solid #d9cbff; border-radius: 9999px; }
.ask-tippy-me__suggestions button:hover { background: #eee6ff; }
.ask-tippy-me__form { display: flex; gap: .45rem; padding: .75rem; border-top: 1px solid #eee6ff; }
.ask-tippy-me__form input { min-width: 0; flex: 1; padding: .65rem .75rem; color: #1a1228; border: 1px solid #d9cbff; border-radius: .65rem; outline-color: #9362ff; }
.ask-tippy-me__form button { width: 2.45rem; color: #3b1d7a; font-size: 1.2rem; background: #ceff83; border: 1px solid #b5e76e; border-radius: .65rem; }
.ask-chat-enter-active, .ask-chat-leave-active { transition: opacity .18s ease, transform .18s ease; }
.ask-chat-enter-from, .ask-chat-leave-to { opacity: 0; transform: translateY(.5rem) scale(.98); }
@media (max-width: 640px) { .ask-tippy-me { right: .8rem; bottom: max(.8rem, env(safe-area-inset-bottom)); } .ask-tippy-me__trigger { min-height: 3rem; } }
@media (prefers-reduced-motion: reduce) {
  .ask-tippy-me__trigger, .ask-tippy-me__dice, .ask-tippy-me__arrow,
  .ask-chat-enter-active, .ask-chat-leave-active { transition: none; }
  .ask-tippy-me__trigger:hover, .ask-tippy-me__trigger:active { transform: none; }
}
</style>
