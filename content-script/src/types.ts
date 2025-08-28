export type ChatRole = "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };

// If you don't have chrome types installed, this prevents TS errors
// declare const chrome: any;

export interface State {
  stopped: boolean;
  running: boolean;
  repliedIds: Set<string>;
  skippedIds: Set<string>;
  attemptsById: Map<string, number>;
  anySuccessThisRun: boolean;
  observer: MutationObserver | null;
  currentArticle: HTMLElement | null;
  semiAuto: boolean; // NEW: require approve before submitting
}

export interface FindTweetHit {
  article: HTMLElement;
  score: number;
}

export interface State {
  stopped: boolean;
  running: boolean;
  repliedIds: Set<string>;
  skippedIds: Set<string>;
  attemptsById: Map<string, number>;
  anySuccessThisRun: boolean;
  observer: MutationObserver | null;
  currentArticle: HTMLElement | null;
}

// const state: State = {
//   stopped: false,
//   running: false,
//   repliedIds: new Set(),
//   skippedIds: new Set(),
//   attemptsById: new Map(),
//   anySuccessThisRun: false,
//   observer: null,
//   currentArticle: null,
//   semiAuto: true, // default ON; toggle with a button if you want
// };

export type ApprovalResult = "approve" | "skip" | "stop";

export interface State {
  stopped: boolean;
  running: boolean;
  repliedIds: Set<string>;
  skippedIds: Set<string>;
  attemptsById: Map<string, number>;
  anySuccessThisRun: boolean;
  observer: MutationObserver | null;
  currentArticle: HTMLElement | null;
  semiAuto: boolean;
}

export type AnalyzedPost = {
  post_kind: "original" | "reply" | "retweet" | "quote" | "ad";
  is_truncated: boolean;
  language: string | null;
  author_name: string;
  author_handle: string;
  tweet_text: string;
  media_description: string;
  image_text: string;
  relationships: string;
  hidden_or_subtext: string;
  author_intent: string;
  author_tone: string;
  audience: string;
  context_or_background: string;
  why_now: string;
  risks_to_avoid: string;
  takeaway: string;
  key_ideas: string[];
  conversation_hooks: string[];
  suggested_reply: {
    short: string;
    question: string;
    value_add: string;
  };
  confidence: "low" | "medium" | "high";
};

// Tabs
export type Tab = "chat" | "analysis";
