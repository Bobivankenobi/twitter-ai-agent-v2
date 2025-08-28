import { sleep } from "../utils";
import { CONFIG, OFFSET_TOP_PX, SELECTOR } from "../constants";
import { State } from "../types";

export const scrollToAlignTop = (el: HTMLElement): void => {
  const rect = el.getBoundingClientRect();
  const y = window.scrollY + rect.top - OFFSET_TOP_PX;
  window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
};

export const waitUntilAligned = async (
  el: HTMLElement,
  tol: number = CONFIG.alignTolerancePx,
  maxWaitMs: number = CONFIG.alignMaxWaitMs,
  state: State
): Promise<boolean> => {
  const start = performance.now();
  while (performance.now() - start < maxWaitMs) {
    if (state.stopped) return false;
    const top = el.getBoundingClientRect().top;
    if (top >= OFFSET_TOP_PX - tol && top <= OFFSET_TOP_PX + tol) return true;
    await sleep(50);
  }
  return false;
};

export const circleCurrentArticle = (): void => {
  if (document.getElementById("ta-style")) return;
  const el = document.createElement("style");
  el.id = "ta-style";
  el.textContent = `
    .ta-current { outline: 3px solid red !important; border-radius: 10px; }
  `;
  document.head.appendChild(el);
};

export const isVisible = (el: Element): boolean => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};

export const candidatesSorted = (): HTMLElement[] => {
  const arr = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR))
    .filter(isVisible)
    .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  return arr;
};

export const setCurrentArticle = (a: HTMLElement | null, state: State): void => {
  if (state.currentArticle && state.currentArticle.isConnected) {
    state.currentArticle.classList.remove("ta-current");
    state.currentArticle.dataset.current = "0";
  }
  state.currentArticle = a;
  if (a) {
    a.classList.add("ta-current");
    a.dataset.current = "1";
  }
};

export const jumpToArticle = async (
  a: HTMLElement | null,
  tol: number = CONFIG.alignTolerancePx,
  maxWaitMs: number = CONFIG.alignMaxWaitMs,
  state: State
): Promise<void> => {
  if (!a) return;
  setCurrentArticle(a, state);
  scrollToAlignTop(a);
  await waitUntilAligned(a, tol, maxWaitMs, state);
};

export const currentIndex = (arr: HTMLElement[], state: State): number => {
  if (!state.currentArticle) return -1;
  return arr.indexOf(state.currentArticle);
};

export const gotoNext = async (
  delta = +1,
  tol: number = CONFIG.alignTolerancePx,
  maxWaitMs: number = CONFIG.alignMaxWaitMs,
  state: State
): Promise<void> => {
  const arr = candidatesSorted();
  if (!arr.length) return;
  let idx = currentIndex(arr, state);
  if (idx === -1) {
    const below = arr.find((el) => el.getBoundingClientRect().top > 0);
    await jumpToArticle(below || arr[0], tol, maxWaitMs, state);
    return;
  }
  idx = Math.min(Math.max(idx + delta, 0), arr.length - 1);
  await jumpToArticle(arr[idx], tol, maxWaitMs, state);
};
