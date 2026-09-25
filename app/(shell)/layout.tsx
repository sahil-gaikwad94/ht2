import type { Metadata } from 'next';
import { AppGate } from '@/components/boot/AppGate';
import { EditorialDock, MobileTabs, ReferenceHeader } from '@/components/shell/Shell';
import { ReadingDock } from '@/components/reading/ReadingDock';

export const metadata: Metadata = {
  title: { default: 'heatt — where ideas burn', template: '%s · heatt' },
};

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppGate>
      <div className="reference-room">
        <ReferenceHeader />
        <div className="editorial-workspace">
          <EditorialDock />
          <main className="editorial-stage mx-auto min-w-0 w-full max-w-[1080px] px-4 pb-[120px] pt-0 sm:px-6 md:pb-[140px]">{children}</main>
          <aside className="editorial-aside"><span>THE ROOM IS QUIET</span><p>Save something for later. The best things rarely need to be chased.</p><div className="editorial-aside__line" /></aside>
        </div>
      </div>
      <MobileTabs />
      <ReadingDock />
    </AppGate>
  );
}
