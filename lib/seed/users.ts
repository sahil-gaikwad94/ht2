import type { User } from '../types';

/* ============================================================================
   heatt seed community — the founding forgers.
   (Fictional seed identities used to solve the cold-start demo; real syndicated
   authors from the Dev.to API are rendered with their own metadata.)
   ==========================================================================*/

export const SEED_USERS: User[] = [
  {
    handle: 'nyra',
    name: 'Nyra Okonkwo',
    bio: 'Designs interfaces that behave like materials. Ex-Vercel. Obsessed with heat, shadow and 120Hz.',
    cover: '/art/molten-ui.jpg',
    location: 'Lisbon',
    site: 'nyra.forge',
    joined: '2025-11-04',
    followers: 18420,
    following: 312,
    thermalMass: 1.85,
    traits: ['design', 'motion', 'dark-ui'],
    verified: true,
    org: 'heatt studio',
  },
  {
    handle: 'k-vasiliev',
    name: 'Kirill Vasiliev',
    bio: 'Graphics programmer. I write shaders until they stop lying to me.',
    cover: '/art/shader-flames.jpg',
    location: 'Tallinn',
    joined: '2026-01-19',
    followers: 9210,
    following: 88,
    thermalMass: 1.52,
    traits: ['webgl', 'gpu', 'perf'],
  },
  {
    handle: 'amara',
    name: 'Amara Singh',
    bio: 'Type nerd & long-form editor. If it can be read at 2am without glasses, it ships.',
    cover: '/art/cold-type.jpg',
    location: 'Toronto',
    site: 'amara.type',
    joined: '2025-09-02',
    followers: 24110,
    following: 140,
    thermalMass: 2.1,
    traits: ['typography', 'editing', 'reading'],
    verified: true,
  },
  {
    handle: 'tobi',
    name: 'Tobias Lund',
    bio: 'Infra for people with 0 budget and 100% ambition. Edge caching evangelist.',
    cover: '/art/ember-signal.jpg',
    location: 'Copenhagen',
    joined: '2026-03-11',
    followers: 6120,
    following: 402,
    thermalMass: 1.2,
    traits: ['edge', 'postgres', 'self-host'],
  },
  {
    handle: 'sena',
    name: 'Sena Aydın',
    bio: 'Behavioural researcher turned product designer. Streaks are a promise, not a badge.',
    cover: '/art/graphite-lattice.jpg',
    location: 'Istanbul',
    joined: '2026-02-27',
    followers: 11340,
    following: 219,
    thermalMass: 1.44,
    traits: ['habits', 'research', 'gamification'],
  },
  {
    handle: 'marta',
    name: 'Marta Ferreira',
    bio: 'Reader first, writer second. 3.2M words heated on heatt.',
    joined: '2026-05-06',
    location: 'Porto',
    followers: 840,
    following: 611,
    thermalMass: 0.9,
    traits: ['reading'],
  },
  {
    handle: 'devon',
    name: 'Devon Reyes',
    bio: 'Frontend, physics, and the occasional 4am refactor.',
    joined: '2026-04-14',
    location: 'Austin',
    followers: 2980,
    following: 176,
    thermalMass: 1.05,
    traits: ['frontend', 'physics'],
  },
  {
    handle: 'heatt',
    name: 'heatt',
    bio: 'The official account. Sparks for the noise, forges for the signal.',
    cover: '/art/hero-forge.jpg',
    site: 'heatt.app',
    joined: '2025-08-01',
    followers: 51200,
    following: 12,
    thermalMass: 2.6,
    traits: ['official'],
    verified: true,
    org: 'heatt',
  },
];

export const userByHandle = new Map(SEED_USERS.map((u) => [u.handle, u]));

export function getUser(handle: string): User {
  return (
    userByHandle.get(handle) ?? {
      handle,
      name: handle.replace(/[-_.]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      bio: 'New voice on heatt.',
      joined: new Date().toISOString().slice(0, 10),
      followers: 1,
      following: 0,
      thermalMass: 1,
    }
  );
}
