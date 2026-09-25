/* ============================================================================
   Live syndication snapshot — metadata index of free articles from the public
   Forem (Dev.to) API, captured at seed time so the feed is never empty.
   Only factual metadata + canonical links are stored. Article bodies are
   fetched per-read and rendered natively in-app (no redirect out).
   ==========================================================================*/

export type SyndicatedMeta = {
  id: number;
  title: string;
  excerpt: string;
  handle: string;
  author: string;
  org?: string;
  path: string;
  canonical: string;
  date: string;
  minutes: number;
  reactions: number;
  comments: number;
  tags: string[];
  cover?: string;
  avatar?: string;
  flare?: string;
};

export const DEVTO_BASE = 'https://dev.to';

export const SYNDICATED: SyndicatedMeta[] = [
  {
    id: 4652133,
    title: 'What Happens When AI Outgrows the Tests We Use to Measure It?',
    excerpt:
      'A familiar conversation keeps recurring every time a model clears a benchmark: were the benchmarks wrong, or is the measuring stick the real limit? A look at why evals decay and what replaces them.',
    handle: 'hemapriya_kanagala',
    author: 'Hemapriya Kanagala',
    path: '/hemapriya_kanagala/what-happens-when-ai-outgrows-the-tests-we-use-to-measure-it-30al',
    canonical:
      'https://dev.to/hemapriya_kanagala/what-happens-when-ai-outgrows-the-tests-we-use-to-measure-it-30al',
    date: '2026-09-14T17:12:10Z',
    minutes: 14,
    reactions: 126,
    comments: 42,
    tags: ['discuss', 'ai', 'programming', 'chatgpt'],
    cover:
      'https://media2.dev.to/dynamic/image/width=1000,height=420,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.us-east-2.amazonaws.com%2Fuploads%2Farticles%2Fmbizy1bvs5mibcqzbtyo.jpeg',
    avatar:
      'https://media2.dev.to/dynamic/image/width=90,height=90,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.us-east-2.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3307586%2F2dffaf97-946d-44a6-8a39-07d94a72e07d.png',
    flare: 'discuss',
  },
  {
    id: 4667014,
    title: 'How we built a desktop companion robot with Gemma 4 and Raspberry Pi',
    excerpt:
      'Behind-the-scenes on DinoDesk AI: a privacy-first desk robot running a hybrid local Gemma 4 / cloud Gemini architecture on a Pi, with the failure modes you would expect from a toy with a microphone.',
    handle: 'googleai',
    author: 'bebechien',
    org: 'Google AI',
    path: '/googleai/how-we-built-a-desktop-companion-robot-with-gemma-4-and-raspberry-pi-2oke',
    canonical: '/googleai/how-we-built-a-desktop-companion-robot-with-gemma-4-and-raspberry-pi-2oke',
    date: '2026-09-16T10:15:52Z',
    minutes: 5,
    reactions: 38,
    comments: 6,
    tags: ['raspberrypi', 'gemma', 'gemini', 'robotics'],
    cover:
      'https://media2.dev.to/dynamic/image/width=1000,height=420,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fbebechien.github.io%2Fcozy-corner-future%2Fimages%2Fhow-we-built-a-desktop-companion-robot.png',
  },
  {
    id: 4657709,
    title: 'The Slow and Quiet Cognitive Atrophy of a Modern Software Engineer',
    excerpt:
      'What is left of your reasoning when the tool writes the first draft every time? A practitioner’s argument for deliberate friction, and a checklist for keeping your own judgement load-bearing.',
    handle: 'codingwithjiro',
    author: 'Elmar Chavez',
    path: '/codingwithjiro/the-slow-and-quiet-cognitive-atrophy-of-a-modern-software-engineer-3lbh',
    canonical: '/codingwithjiro/the-slow-and-quiet-cognitive-atrophy-of-a-modern-software-engineer-3lbh',
    date: '2026-09-15T14:45:01Z',
    minutes: 9,
    reactions: 88,
    comments: 40,
    tags: ['software', 'ai', 'programming', 'productivity'],
    cover:
      'https://media2.dev.to/dynamic/image/width=1000,height=420,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.us-east-2.amazonaws.com%2Fuploads%2Farticles%2Fullwog99birf3pzk4teh.webp',
  },
  {
    id: 4617912,
    title: 'AI Is Already Better at Coding Than Most Software Developers',
    excerpt:
      'A provocative one: coding was never the most valuable part of software. Where the leverage actually moved — and why the job description nobody updated is the real problem.',
    handle: 'sylwia-lask',
    author: 'Sylwia Laskowska',
    path: '/sylwia-lask/ai-is-already-better-at-coding-than-most-software-developers-4hno',
    canonical: '/sylwia-lask/ai-is-already-better-at-coding-than-most-software-developers-4hno',
    date: '2026-09-10T07:17:46Z',
    minutes: 5,
    reactions: 243,
    comments: 193,
    tags: ['discuss', 'ai', 'webdev', 'programming'],
    cover:
      'https://media2.dev.to/dynamic/image/width=1000,height=420,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.us-east-2.amazonaws.com%2Fuploads%2Farticles%2Ft7ukzmu9bsqznsk6w54g.png',
    flare: 'discuss',
  },
  {
    id: 4642467,
    title: "Vibe Coding Isn't the Problem. Calling It Engineering Is",
    excerpt:
      'Two hours of prompting is a prototype, not a system. On naming, craft, and what "engineering" has to mean for it to be worth the word.',
    handle: 'georgekobaidze',
    author: 'Giorgi Kobaidze',
    path: '/georgekobaidze/vibe-coding-isnt-the-problem-calling-it-engineering-is-lm1',
    canonical: '/georgekobaidze/vibe-coding-isnt-the-problem-calling-it-engineering-is-lm1',
    date: '2026-09-13T07:06:59Z',
    minutes: 3,
    reactions: 169,
    comments: 218,
    tags: ['ai', 'machinelearning', 'coding', 'development'],
    cover:
      'https://media2.dev.to/dynamic/image/width=1000,height=420,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.us-east-2.amazonaws.com%2Fuploads%2Farticles%2Fadaw007461om7bsld6j4.jpeg',
  },
  {
    id: 4632958,
    title:
      'Dev Opportunity Radar #16: $15K AI Agent Hackathon, AI Education Fellowship, and AWS Student Rewards',
    excerpt:
      'A weekly curated sweep of grants, hackathons and programmes worth a developer’s afternoon, with deadlines and what each one actually asks of you.',
    handle: 'devengers',
    author: 'Devengers',
    path: '/devengers/dev-opportunity-radar-16-15k-ai-agent-hackathon-ai-education-fellowship-and-aws-student-rewards-4l2e',
    canonical:
      '/devengers/dev-opportunity-radar-16-15k-ai-agent-hackathon-ai-education-fellowship-and-aws-student-rewards-4l2e',
    date: '2026-09-11T13:59:00Z',
    minutes: 4,
    reactions: 98,
    comments: 31,
    tags: ['discuss', 'community', 'career', 'devchallenge'],
    flare: 'discuss',
  },
  {
    id: 4669106,
    title: 'Build real-time voice applications with Gemini Live and Transcribe',
    excerpt:
      'Streaming audio in and out of a model without a call centre full of infrastructure: latency budgets, interruption handling, and the API surface for real-time voice.',
    handle: 'googleai',
    author: 'Google AI',
    org: 'Google AI',
    path: '/googleai/build-real-time-voice-applications-with-gemini-live-and-transcribe',
    canonical: '/googleai/build-real-time-voice-applications-with-gemini-live-and-transcribe',
    date: '2026-09-17T09:00:00Z',
    minutes: 6,
    reactions: 54,
    comments: 4,
    tags: ['ai', 'voice', 'api', 'tutorial'],
  },
];
