import {
  DEFAULT_SURPRISE_GIFT_CONFIG,
  type SurpriseGiftConfig,
} from '@/src/config/surpriseGiftConfig';

/**
 * Repository contract for the surprise gift configurator.
 * Replace this browser adapter with API/DB reads and writes when a backend is ready.
 */
export interface SurpriseGiftConfigRepository {
  read(): SurpriseGiftConfig;
  write(config: SurpriseGiftConfig): boolean;
}

const STORAGE_KEY = 'surprise-gift-config-v1';

const browserRepository: SurpriseGiftConfigRepository = {
  read() {
    if (typeof window === 'undefined') return DEFAULT_SURPRISE_GIFT_CONFIG;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_SURPRISE_GIFT_CONFIG;
      const saved = JSON.parse(raw) as Partial<SurpriseGiftConfig>;
      return {
        ...DEFAULT_SURPRISE_GIFT_CONFIG,
        ...saved,
        ribbonColors: saved.ribbonColors ?? DEFAULT_SURPRISE_GIFT_CONFIG.ribbonColors,
        pricing: { ...DEFAULT_SURPRISE_GIFT_CONFIG.pricing, ...saved.pricing },
        recipientOptions: {
          ...DEFAULT_SURPRISE_GIFT_CONFIG.recipientOptions,
          ...saved.recipientOptions,
        },
        recommendationTerms: {
          ages: { ...DEFAULT_SURPRISE_GIFT_CONFIG.recommendationTerms.ages, ...saved.recommendationTerms?.ages },
          styles: { ...DEFAULT_SURPRISE_GIFT_CONFIG.recommendationTerms.styles, ...saved.recommendationTerms?.styles },
        },
        itemVolumes: { ...DEFAULT_SURPRISE_GIFT_CONFIG.itemVolumes, ...saved.itemVolumes },
        catalogOptions: { ...DEFAULT_SURPRISE_GIFT_CONFIG.catalogOptions, ...saved.catalogOptions },
        ideaSuggestions: { ...DEFAULT_SURPRISE_GIFT_CONFIG.ideaSuggestions, ...saved.ideaSuggestions },
      } as SurpriseGiftConfig;
    } catch {
      return DEFAULT_SURPRISE_GIFT_CONFIG;
    }
  },
  write(config) {
    if (typeof window === 'undefined') return false;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      window.dispatchEvent(new CustomEvent('surprise-gift-config-updated'));
      return true;
    } catch (error) {
      console.error('No se pudo guardar la configuración de regalos sorpresa.', error);
      return false;
    }
  },
};

export const surpriseGiftConfigRepository = browserRepository;
export const SURPRISE_GIFT_CONFIG_STORAGE_KEY = STORAGE_KEY;
