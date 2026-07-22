const KEY = "pedidos-online:novos";
const EVT = "pedidos-online:changed";

export function getNovos(): number {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(KEY) || "0");
}
export function setNovos(n: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, String(Math.max(0, n)));
  window.dispatchEvent(new Event(EVT));
}
export function addNovos(n: number) {
  setNovos(getNovos() + n);
}
export function clearNovos() {
  setNovos(0);
}
export function onNovosChange(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const h = () => cb();
  window.addEventListener(EVT, h);
  window.addEventListener("storage", h);
  return () => {
    window.removeEventListener(EVT, h);
    window.removeEventListener("storage", h);
  };
}

const SOUND_KEY = "pedidos-online:som";
export const getSomAtivo = (): boolean => {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(SOUND_KEY) !== "0";
};
export const setSomAtivo = (v: boolean) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(SOUND_KEY, v ? "1" : "0");
};

export function beep() {
  if (typeof window === "undefined") return;
  if (!getSomAtivo()) return;
  try {
    const AC =
      (
        window as unknown as {
          AudioContext?: typeof AudioContext;
          webkitAudioContext?: typeof AudioContext;
        }
      ).AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const play = (freq: number, start: number, dur: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      o.connect(g);
      g.connect(ctx.destination);
      const t = ctx.currentTime + start;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t);
      o.stop(t + dur + 0.02);
    };
    play(880, 0, 0.18);
    play(1320, 0.18, 0.22);
    setTimeout(() => ctx.close(), 700);
  } catch {
    /* ignore */
  }
}
