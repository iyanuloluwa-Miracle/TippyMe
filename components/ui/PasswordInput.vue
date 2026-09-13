<template>
  <div class="relative mt-1.5">
    <input
      :id="id"
      :value="modelValue"
      :type="visible ? 'text' : 'password'"
      :name="name"
      :autocomplete="autocomplete"
      :required="required"
      :disabled="disabled"
      :placeholder="placeholder"
      :minlength="minlength"
      class="w-full rounded-xl border border-black/10 bg-[#f7f4ff] py-2.5 pl-3.5 pr-11 text-base text-cheer-ink placeholder:text-cheer-ink/35 transition-colors duration-200 focus:border-cheer-leaf/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cheer-leaf/30 disabled:opacity-60"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <button
      type="button"
      class="absolute inset-y-0 right-0 flex items-center px-3 text-cheer-ink/45 transition-colors hover:text-cheer-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cheer-leaf focus-visible:ring-inset rounded-r-xl"
      :aria-label="visible ? 'Hide password' : 'Show password'"
      :aria-pressed="visible"
      :disabled="disabled"
      @click="visible = !visible"
    >
      <!-- Eye (show) -->
      <svg
        v-if="!visible"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="h-5 w-5"
        aria-hidden="true"
      >
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <!-- Eye-off (hide) -->
      <svg
        v-else
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="h-5 w-5"
        aria-hidden="true"
      >
        <path d="M9.9 4.2A10.7 10.7 0 0 1 12 4c6.5 0 10 8 10 8a18.5 18.5 0 0 1-2.2 3.3" />
        <path d="M6.1 6.1C3.7 7.8 2 12 2 12s3.5 7 10 7a10.7 10.7 0 0 0 4.2-.8" />
        <path d="M14.1 14.1a3 3 0 0 1-4.2-4.2" />
        <path d="M2 2l20 20" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    id: string;
    modelValue: string;
    name?: string;
    autocomplete?: 'current-password' | 'new-password';
    required?: boolean;
    disabled?: boolean;
    placeholder?: string;
    minlength?: number | string;
  }>(),
  {
    name: 'password',
    autocomplete: 'current-password',
    required: true,
    disabled: false,
    placeholder: '••••••••',
    minlength: 8,
  },
);

defineEmits<{
  'update:modelValue': [value: string];
}>();

const visible = ref(false);
</script>
