export const UTM_PARAM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

export type UtmParamKey = (typeof UTM_PARAM_KEYS)[number];

export interface UtmAttributionData {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  landing_page?: string;
  last_touch_page?: string;
  referrer?: string;
}

export interface StoredUtmAttribution extends UtmAttributionData {
  capturedAt: string;
}

