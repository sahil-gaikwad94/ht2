'use client';
import * as React from 'react';
import { AppProvider } from '@/lib/app';

/**
 * Client boundary for the whole app: providers, the global WebGL atmosphere,
 * grain and the ambient "temperature" of the shell (the page background gets
 * warmer as the session heats up — the ranker leaks into the room).
 */
export function ShellProviders({ children }: { children: React.ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}
