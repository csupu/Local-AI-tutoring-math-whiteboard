/** localStorage-backed preferences. Nothing is hardcoded server-side. */

export const K = {
  theme: 'mathtools.theme',
  model: 'mathtools.model',
  grid: 'mathtools.grid',
  bg: 'mathtools.bg',
  panelWidth: 'mathtools.panelWidth',
  panelOpen: 'mathtools.panelOpen',
  autoAnalyze: 'mathtools.autoAnalyze',
} as const;

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — ignore */
  }
}

export const uid = (): string =>
  `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));
