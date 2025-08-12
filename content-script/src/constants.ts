export const OFFSET_TOP_PX = 65; // align article ~65px from top
export const STEP_MS = 3000; // dwell per article (min time)
export const BATCH_SIZE = 6; // after a batch, load more
export const LOAD_SCROLL_STEP = Math.round(window.innerHeight * 0.8);
export const SELECTOR = 'article[role="article"][data-testid="tweet"]';