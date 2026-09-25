'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useStore } from '@/lib/store';

const chapters = [
  { no: '01', title: 'Find the thread', body: 'A quiet place for the link between a passing idea and the thing you cannot stop thinking about.', art: '/art/ref-curiosity-portal.jpg' },
  { no: '02', title: 'Stay with it', body: 'Read the whole piece without leaving. Save the sentence. Follow the author. Come back when the thought is ready.', art: '/art/ref-dark-apps.jpg' },
  { no: '03', title: 'Send the feeling', body: 'Turn a passage into a beautiful, human-sized story card — something worth sharing, not another notification.', art: '/art/ref-profile.jpg' },
];

export default function Landing() {
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, .5], [0, -120]);
  const [reel, setReel] = React.useState(0);
  const enter = () => {
    useStore.setState({ introSeen: false, onboarded: false });
    window.location.href = '/feed';
  };
  return (
    <main className="landing-new">
      <div className="landing-new__grain" aria-hidden />
      <nav className="landing-nav">
        <Link href="/" className="landing-brand"><span>h</span><b>heatt</b></Link>
        <div className="landing-nav__links"><a href="#why">Why heatt</a><a href="#reel">The reel</a><a href="#share">Share beautifully</a></div>
        <button onClick={enter} className="landing-nav__enter">Enter the room <span>↗</span></button>
      </nav>
      <section className="landing-hero">
        <motion.div className="landing-hero__image" style={{ y: heroY }} aria-hidden><img src="/art/ref-curiosity-portal.jpg" alt="" /></motion.div>
        <div className="landing-hero__veil" aria-hidden />
        <div className="landing-hero__copy"><p className="landing-kicker"><i /> a room for things that stay with you</p><h1>Don’t just scroll.<br /><em>follow the thread.</em></h1><p className="landing-hero__dek">heatt is a reading-first social space for short observations, deep stories, and the quiet ideas between them.</p><div className="landing-hero__actions"><button onClick={enter} className="landing-primary">Step inside <span>↗</span></button><a href="#why" className="landing-secondary">See how it feels <span>↓</span></a></div></div>
        <div className="landing-hero__stamp">01 / 03<br /><span>OPEN ROOM</span></div>
      </section>
      <section id="why" className="landing-manifesto"><div className="landing-manifesto__side"><span>WHY HEATT</span><span>2026 — A READING ROOM</span></div><div><p className="landing-kicker"><i /> less noise, more signal</p><h2>The internet is full of things worth your attention. The hard part is <em>staying long enough</em> to find them.</h2><p className="landing-body">We made a place that slows the hand down. Short notes can open into full stories. Every link gets a preview. Every article lives here. Your library becomes a record of what moved you — not a scoreboard.</p></div></section>
      <section id="reel" className="landing-reel"><div className="landing-section-head"><div><p className="landing-kicker"><i /> three small promises</p><h2>A different kind of feed.</h2></div><div className="landing-reel__count">0{reel + 1} <span>/ 03</span></div></div><div className="landing-reel__stage"><div className="landing-reel__art"><img src={chapters[reel].art} alt="" /><span className="landing-reel__art-no">{chapters[reel].no}</span></div><div className="landing-reel__words"><p className="landing-kicker"><i /> chapter {chapters[reel].no}</p><h3>{chapters[reel].title}</h3><p>{chapters[reel].body}</p><div className="landing-reel__controls">{chapters.map((x, i) => <button key={x.no} onClick={() => setReel(i)} className={i === reel ? 'active' : ''}><span>{x.no}</span>{x.title}</button>)}</div></div></div></section>
      <section id="share" className="landing-share"><div className="landing-share__copy"><p className="landing-kicker"><i /> made to be carried forward</p><h2>Your best thoughts deserve better than a link.</h2><p>Make a story out of a line, a cover out of a feeling, or a small artifact out of the thing you keep returning to.</p><button onClick={enter} className="landing-primary">Open the reading room <span>↗</span></button></div><div className="landing-share__card"><div className="landing-share__top"><span>heatt / story 01</span><span>shareable thought</span></div><div className="landing-share__quote">“The things we return to are the things that shape us.”</div><div className="landing-share__bottom"><span>read slowly · keep the good parts</span><b>h</b></div></div></section>
      <footer className="landing-footer"><span>heatt — a room for ideas</span><span>made for the curious</span><button onClick={enter}>Enter ↗</button></footer>
    </main>
  );
}
