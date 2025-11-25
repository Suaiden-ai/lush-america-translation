import { StoredUtmAttribution, UTM_PARAM_KEYS, UtmParamKey } from '../types/utm';

const STORAGE_KEY = 'lush-america:utm-attribution';
const TTL_MS = 1000 * 60 * 60 * 24 * 60; // 60 dias

const isBrowser = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const getCurrentPath = () => {
  if (!isBrowser()) return '';
  return `${window.location.pathname}${window.location.search}`;
};

const shouldOverrideExisting = (existing: StoredUtmAttribution | null) => {
  if (!existing) return true;
  const capturedAt = new Date(existing.capturedAt).getTime();
  return Number.isNaN(capturedAt) || Date.now() - capturedAt > TTL_MS;
};

const sanitizeValue = (value: string | undefined | null) => value?.trim() || undefined;

const normalizePayload = (payload: StoredUtmAttribution): StoredUtmAttribution => ({
  ...payload,
  utm_source: sanitizeValue(payload.utm_source),
  utm_medium: sanitizeValue(payload.utm_medium),
  utm_campaign: sanitizeValue(payload.utm_campaign),
  utm_term: sanitizeValue(payload.utm_term),
  utm_content: sanitizeValue(payload.utm_content),
  landing_page: sanitizeValue(payload.landing_page),
  last_touch_page: sanitizeValue(payload.last_touch_page),
  referrer: sanitizeValue(payload.referrer),
});

const buildUtmRecord = (params: URLSearchParams) => {
  const utmRecord: Partial<Record<UtmParamKey, string>> = {};
  let hasValue = false;

  UTM_PARAM_KEYS.forEach((key) => {
    const value = params.get(key);
    if (value) {
      utmRecord[key] = value;
      hasValue = true;
    }
  });

  return { utmRecord, hasValue };
};

export const getStoredUtmParams = (): StoredUtmAttribution | null => {
  if (!isBrowser()) return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as StoredUtmAttribution;
    if (!parsed?.capturedAt) return null;

    const capturedAt = new Date(parsed.capturedAt).getTime();
    if (Number.isNaN(capturedAt) || Date.now() - capturedAt > TTL_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return normalizePayload(parsed);
  } catch (error) {
    console.warn('[utmTracker] Falha ao ler UTM armazenado', error);
    return null;
  }
};

export const persistUtmParams = (payload: StoredUtmAttribution) => {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizePayload(payload)));
  } catch (error) {
    console.warn('[utmTracker] Não foi possível persistir UTM', error);
  }
};

export const clearUtmParams = () => {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('[utmTracker] Não foi possível limpar UTM', error);
  }
};

export const captureUtmFromUrl = (): StoredUtmAttribution | null => {
  if (!isBrowser()) return null;

  const params = new URLSearchParams(window.location.search);
  const { utmRecord, hasValue } = buildUtmRecord(params);
  const existing = getStoredUtmParams();
  const currentPath = getCurrentPath();

  if (!hasValue) {
    if (existing) {
      const refreshed = {
        ...existing,
        last_touch_page: currentPath || existing.last_touch_page,
      };
      persistUtmParams(refreshed);
      return refreshed;
    }
    return null;
  }

  const override = shouldOverrideExisting(existing);
  const base = override || !existing ? {} : existing;
  const capturedAt = override || !existing ? new Date().toISOString() : existing!.capturedAt;
  const referrer = override ? document?.referrer || undefined : existing?.referrer || document?.referrer || undefined;
  const landingPage = override ? currentPath : existing?.landing_page || currentPath;

  const payload: StoredUtmAttribution = {
    utm_source: utmRecord.utm_source ?? base.utm_source,
    utm_medium: utmRecord.utm_medium ?? base.utm_medium,
    utm_campaign: utmRecord.utm_campaign ?? base.utm_campaign,
    utm_term: utmRecord.utm_term ?? base.utm_term,
    utm_content: utmRecord.utm_content ?? base.utm_content,
    landing_page: landingPage,
    last_touch_page: currentPath,
    referrer,
    capturedAt,
  };

  persistUtmParams(payload);
  return payload;
};

