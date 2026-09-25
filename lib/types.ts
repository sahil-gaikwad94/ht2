/* ============================================================================
   heatt — core domain types
   ==========================================================================*/

export type HeatLevel = 0 | 1 | 2 | 3;

export type ArticleBlock =
  | { t: 'h'; text: string; id?: string }
  | { t: 'p'; text: string }
  | { t: 'quote'; text: string; cite?: string }
  | { t: 'ul'; items: string[] }
  | { t: 'ol'; items: string[] }
  | { t: 'code'; lang: string; code: string; caption?: string }
  | { t: 'img'; src: string; alt: string; caption?: string; credit?: string }
  | { t: 'hr' }
  | { t: 'callout'; kind: 'heat' | 'note' | 'warn'; title: string; text: string }
  | { t: 'links'; items: { label: string; href: string; note?: string }[] };

export type Article = {
  id: string;
  kind: 'forge'; // long-form
  title: string;
  dek: string; // standfirst
  author: string; // handle
  tags: string[];
  cover: string; // image url
  accent?: string;
  date: string; // ISO
  minutes: number;
  blocks: ArticleBlock[];
  source?: { name: string; url: string };
  canonical?: string;
  reactions?: number;
  comments?: number;
  /** markdown body for live-syndicated articles */
  bodyMarkdown?: string;
  hot?: boolean;
};

export type Spark = {
  id: string;
  kind: 'spark'; // microblog post
  author: string;
  text: string;
  date: string;
  tags?: string[];
  media?: { url: string; alt: string }[];
  link?: { url: string; title: string; site: string; image?: string; desc?: string };
  poll?: { question: string; options: { label: string; votes: number }[] };
  quoteOf?: { author: string; text: string };
  reactions?: number;
  comments?: number;
  reposts?: number;
  longRef?: string; // links a spark to an article it "grew from"
};

export type User = {
  handle: string;
  name: string;
  bio: string;
  avatar?: string; // url or data uri; procedural gradient avatar when absent
  cover?: string;
  location?: string;
  site?: string;
  joined: string;
  followers: number;
  following: number;
  thermalMass: number; // reputation — weight multiplier in Heat Diffusion
  traits?: string[];
  verified?: boolean;
  org?: string;
};

export type FeedItem = (Article | Spark) & {
  /** computed at rank time */
  heat?: number;
  temp?: number;
  trend?: number[];
  authorRef?: User;
  heated?: HeatLevel;
};

export type HeatEvent = { level: HeatLevel; at: number };

export type Notification = {
  id: string;
  type: 'heat' | 'ignite' | 'follow' | 'reply' | 'mention' | 'milestone' | 'digest';
  actor: string;
  text: string;
  at: number;
  read: boolean;
  postId?: string;
  level?: HeatLevel;
};

export type ReadingProgress = {
  articleId: string;
  pct: number;
  updatedAt: number;
  finished?: boolean;
};

export type Prefs = {
  density: 'dense' | 'normal' | 'cozy';
  measure: 'narrow' | 'normal' | 'wide';
  serif: boolean;
  reduceMotion: boolean;
  ambient: boolean; // WebGL heat field on/off
  autoplayVideo: boolean;
  haptics: boolean;
  ignitionFx: 'full' | 'subtle' | 'off';
  customTheme: string;
};
