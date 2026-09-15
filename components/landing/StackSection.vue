<template>
  <section
    :id="section.id"
    class="scroll-mt-28 mt-16 sm:mt-20"
    :aria-labelledby="`${section.id}-heading`"
  >
    <UiSectionHeader
      :eyebrow="section.eyebrow"
      :title="section.title"
      :description="section.description"
      :heading-id="`${section.id}-heading`"
    />

    <UiRevealOnScroll>
      <div
        class="partner-marquee relative mt-10 overflow-hidden sm:mt-12"
        role="region"
        aria-label="Partner logos"
      >
        <div class="partner-marquee__fade partner-marquee__fade--left" aria-hidden="true" />
        <div class="partner-marquee__fade partner-marquee__fade--right" aria-hidden="true" />

        <div class="partner-marquee__track">
          <ul
            v-for="copy in 2"
            :key="copy"
            class="partner-marquee__group"
            role="list"
            :aria-hidden="copy === 2 ? 'true' : undefined"
          >
            <li v-for="partner in partners" :key="`${copy}-${partner.id}`">
              <a
                :href="partner.href"
                target="_blank"
                rel="noopener noreferrer"
                class="partner-marquee__link"
                :tabindex="copy === 2 ? -1 : undefined"
              >
                <img
                  :src="partner.logo"
                  :alt="partner.name"
                  class="partner-marquee__logo"
                  :class="{
                    'partner-marquee__logo--wordmark':
                      partner.id === 'bachs' ||
                      partner.id === 'dicebear' ||
                      partner.id === 'outray',
                    'partner-marquee__logo--mark':
                      partner.id !== 'bachs' &&
                      partner.id !== 'dicebear' &&
                      partner.id !== 'outray',
                  }"
                  loading="lazy"
                  decoding="async"
                />
                <span class="sr-only">{{ partner.name }}</span>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </UiRevealOnScroll>
  </section>
</template>

<script setup lang="ts">
import { stackPartners, stackSection } from '~/data/landing';

const section = stackSection;
const partners = stackPartners;
</script>
