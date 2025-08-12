
// Find reply/like inside a tweet <article> (SVG signature first, fallback by order)
export const getTweetActionButtons = (article: HTMLElement): { replyBtn: HTMLElement | null; likeBtn: HTMLElement | null } => {
  const PATH = {
    reply: /^M1\.751 10c0-4\.42 3\.584-8 8\.005-8/i, // speech bubble
    like: /^M16\.697 5\.5c-1\.222-/i, // heart
  };

  const actionGroup = Array.from(article.querySelectorAll('[role="group"]')).find(
    (g): g is HTMLElement => g instanceof HTMLElement && g.querySelectorAll('button, a[role="button"]').length >= 3 && !!g.querySelector('svg path')
  );

  if (!actionGroup) {
    return {
      replyBtn: null,
      likeBtn: null,
    };
  }

  const buttons = Array.from(actionGroup.querySelectorAll('button, a[role="button"]')).filter(
    (b): b is HTMLElement => b instanceof HTMLElement && !!b.querySelector('svg path')
  );

  // Prefer explicit data-testid if present
  let replyBtn: HTMLElement | null = buttons.find((b) => b.matches('[data-testid="reply"]')) || null;
  let likeBtn: HTMLElement | null =
    buttons.find((b) => b.matches('[data-testid="like"], [data-testid="unlike"]')) || null;

  // Otherwise classify via SVG path
  const kind = (btn: HTMLElement): string => btn.querySelector('svg path')?.getAttribute('d') || '';
  replyBtn = replyBtn || buttons.find((b) => PATH.reply.test(kind(b))) || null;
  likeBtn = likeBtn || buttons.find((b) => PATH.like.test(kind(b))) || null;

  // Fallback by horizontal order (reply, retweet, like, ...)
  if (!replyBtn || !likeBtn) {
    const sorted = buttons
      .map((b) => ({
        b,
        x: b.getBoundingClientRect().left,
      }))
      .sort((a, z) => a.x - z.x)
      .map((o) => o.b);
    replyBtn = replyBtn || sorted[0] || null;
    likeBtn = likeBtn || sorted[2] || null;
  }

  return {
    replyBtn,
    likeBtn,
  };
};