'use client';
import * as React from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/app';
import { HeatDashboard } from '@/components/heat/Heatmap';

export default function HeatmapPage() {
  const app = useApp();
  const streak = app.streak.current;

  return (
    <div className="mx-auto w-full max-w-[980px]">
      {/* page header — same anatomy as the feed and library */}
      <header className="flex items-end gap-3 px-1 pb-4 pt-3">
        <div className="min-w-0 flex-1">
          <span className="ht-label">the ledger</span>
          <h1 className="ht-title mt-1 truncate text-[clamp(1.5rem,1.2rem+1.4vw,2.1rem)] leading-tight text-ink">
            Heat map
          </h1>
          <p className="mt-1 truncate text-[12.5px] text-ink-mute">
            Every day you showed up, lit — <span className="text-ember-300">{streak}d</span> and counting.
          </p>
        </div>
        <Link href="/feed" className="ht-btn ht-btn--ghost hidden !py-2 !text-[12.5px] sm:block">
          Back to the board
        </Link>
      </header>

      <div className="pb-8">
        <HeatDashboard />
      </div>
    </div>
  );
}
