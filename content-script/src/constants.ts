export const OFFSET_TOP_PX = 65; // align article ~65px from top
export const STEP_MS = 3000; // dwell per article (min time)
export const BATCH_SIZE = 6; // after a batch, load more
export const LOAD_SCROLL_STEP = Math.round(window.innerHeight * 0.8);
export const SELECTOR = 'article[role="article"][data-testid="tweet"]';

// ======================
// Config & State
// ======================

// ======================
// Types
// ======================
interface Config {
  alignTolerancePx: number;
  alignMaxWaitMs: number;
  minMatchScore: number;
  postCloseWaitMs: number;
  scrollAdvanceRatio: number;
  mutationTimeoutMs: number;
  persistKey: string;
  maxAttemptsPerTweet: number;
}

export const CONFIG: Config = {
  alignTolerancePx: 2,
  alignMaxWaitMs: 1500,
  minMatchScore: 0.55,
  postCloseWaitMs: 1200,
  scrollAdvanceRatio: 0.15,
  mutationTimeoutMs: 6000,
  persistKey: "twitterAgent.repliedIds.v1",
  maxAttemptsPerTweet: 2,
};
