<template>
  <div class="cover-uploader">
    <button
      type="button"
      class="cover-uploader__frame"
      :disabled="disabled || uploading"
      :aria-label="ariaLabel"
      @click="openPicker"
    >
      <img
        v-if="previewSrc"
        :src="previewSrc"
        alt=""
        class="cover-uploader__image"
        decoding="async"
      >
      <div
        v-else
        class="cover-uploader__empty"
      >
        <span aria-hidden="true">▣</span>
        <strong>Add a cover image</strong>
        <small>Wide photo · JPEG, PNG, WebP · up to 5MB</small>
      </div>
      <span class="cover-uploader__overlay">
        {{ uploading ? 'Uploading…' : previewSrc ? 'Change cover' : 'Upload cover' }}
      </span>
    </button>
    <input
      ref="inputRef"
      type="file"
      class="sr-only"
      accept="image/jpeg,image/png,image/webp,image/gif"
      :disabled="disabled || uploading"
      @change="onFileChange"
    >
    <div class="cover-uploader__actions">
      <button
        v-if="modelValue"
        type="button"
        class="cover-uploader__remove"
        :disabled="disabled || uploading || removing"
        @click="removeCover"
      >
        {{ removing ? 'Removing…' : 'Remove cover' }}
      </button>
      <p
        v-if="localError"
        class="cover-uploader__error"
        role="alert"
      >
        {{ localError }}
      </p>
      <p
        v-else-if="hint"
        class="cover-uploader__hint"
      >
        {{ hint }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ApiClientError } from '~/services/api';

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const props = withDefaults(
  defineProps<{
    modelValue?: string | null;
    disabled?: boolean;
    hint?: string;
  }>(),
  {
    modelValue: null,
    disabled: false,
    hint: 'Shown as a banner across the top of your public page.',
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string | null];
  uploaded: [url: string];
  removed: [];
}>();

const api = useApi();
const inputRef = ref<HTMLInputElement | null>(null);
const uploading = ref(false);
const removing = ref(false);
const localError = ref<string | null>(null);
const localPreview = ref<string | null>(null);

const previewSrc = computed(
  () => localPreview.value || props.modelValue?.trim() || null,
);

const ariaLabel = computed(() =>
  uploading.value
    ? 'Uploading cover image'
    : previewSrc.value
      ? 'Change cover image'
      : 'Upload cover image',
);

function openPicker() {
  if (props.disabled || uploading.value) return;
  localError.value = null;
  inputRef.value?.click();
}

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;

  localError.value = null;
  if (!ALLOWED_TYPES.has(file.type)) {
    localError.value = 'Use a JPEG, PNG, WebP, or GIF image.';
    return;
  }

  uploading.value = true;
  const objectUrl = URL.createObjectURL(file);
  localPreview.value = objectUrl;

  try {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Image must be under 5MB.');
    }
    const { url: uploadedUrl } = await api.uploadCover(file);
    const url = uploadedUrl?.trim();
    if (!url) throw new Error('Upload finished but no public URL was returned.');

    const { profile } = await api.updateMyCreatorSettings({ coverImageUrl: url });
    const saved = profile.coverImageUrl?.trim() || url;
    emit('update:modelValue', saved);
    emit('uploaded', saved);
  } catch (err) {
    localPreview.value = null;
    if (err instanceof ApiClientError) {
      localError.value =
        err.errorCode === 'BYTESHIP_NOT_CONFIGURED'
          ? 'Photo uploads are not configured yet. Add BYTESHIP_API_KEY to the server env.'
          : err.message || 'Could not upload cover.';
    } else if (err instanceof Error) {
      localError.value = err.message;
    } else {
      localError.value = 'Could not upload cover.';
    }
  } finally {
    if (localPreview.value === objectUrl) localPreview.value = null;
    URL.revokeObjectURL(objectUrl);
    uploading.value = false;
  }
}

async function removeCover() {
  if (props.disabled || removing.value) return;
  removing.value = true;
  localError.value = null;
  try {
    await api.updateMyCreatorSettings({ coverImageUrl: null });
    emit('update:modelValue', null);
    emit('removed');
  } catch (err) {
    localError.value =
      err instanceof ApiClientError ? err.message : 'Could not remove cover.';
  } finally {
    removing.value = false;
  }
}
</script>

<style scoped>
.cover-uploader { display: grid; gap: 10px; width: 100%; }
.cover-uploader__frame {
  position: relative; display: block; width: 100%; aspect-ratio: 16 / 5;
  overflow: hidden; border-radius: 18px; border: 1px solid #e7dfee;
  background: linear-gradient(135deg, #efe6fb, #f7f2ff); cursor: pointer;
  padding: 0; text-align: left;
}
.cover-uploader__frame:disabled { cursor: not-allowed; opacity: .7; }
.cover-uploader__image { width: 100%; height: 100%; object-fit: cover; display: block; }
.cover-uploader__empty {
  display: grid; place-content: center; justify-items: center; gap: 4px;
  height: 100%; color: #6d5b82; padding: 16px;
}
.cover-uploader__empty span { font-size: 22px; color: #7c4ac0; }
.cover-uploader__empty strong { font-size: 14px; color: #261b38; }
.cover-uploader__empty small { font-size: 12px; text-align: center; }
.cover-uploader__overlay {
  position: absolute; inset: 0; display: grid; place-items: center;
  background: rgba(26, 18, 40, .45); color: #fff; font-size: 12px;
  font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
  opacity: 0; transition: opacity .2s ease;
}
.cover-uploader__frame:hover .cover-uploader__overlay,
.cover-uploader__frame:focus-visible .cover-uploader__overlay { opacity: 1; }
.cover-uploader__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.cover-uploader__remove {
  border: 0; background: transparent; color: #ac3047; font-size: 12px;
  font-weight: 700; cursor: pointer; padding: 0;
}
.cover-uploader__remove:disabled { opacity: .5; cursor: not-allowed; }
.cover-uploader__error { margin: 0; color: #ac3047; font-size: 12px; }
.cover-uploader__hint { margin: 0; color: #6d5b82; font-size: 12px; }
</style>
