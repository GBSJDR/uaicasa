'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { CATEGORY_LABELS, PHOTOS, type PhotoCategory } from '@/lib/data/photos';

export default function Gallery() {
  const [cat, setCat] = useState<PhotoCategory | 'todas'>('todas');
  const [open, setOpen] = useState<number | null>(null);
  const list = cat === 'todas' ? PHOTOS : PHOTOS.filter((p) => p.categories.includes(cat));

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowRight') setOpen((i) => (i! + 1) % list.length);
      if (e.key === 'ArrowLeft') setOpen((i) => (i! - 1 + list.length) % list.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, list.length]);

  return (
    <div>
      <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1">
        {(Object.keys(CATEGORY_LABELS) as (PhotoCategory | 'todas')[]).map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`focus-ring whitespace-nowrap rounded-full px-4 py-2 text-sm transition ${
              cat === c ? 'bg-serra text-white' : 'bg-white text-musgo ring-1 ring-pedra/50 hover:text-tinta'
            }`}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
        {list.map((p, i) => (
          <button
            key={p.src}
            onClick={() => setOpen(i)}
            className="focus-ring group mb-4 block w-full overflow-hidden rounded-2xl"
          >
            <Image
              src={p.src}
              alt={p.alt}
              width={p.w}
              height={p.h}
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="h-auto w-full transition duration-500 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {open !== null && list[open] && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setOpen(null)}
        >
          <figure className="relative max-h-full max-w-6xl" onClick={(e) => e.stopPropagation()}>
            <Image
              src={list[open].src}
              alt={list[open].alt}
              width={list[open].w}
              height={list[open].h}
              className="max-h-[85vh] w-auto rounded-xl object-contain"
              sizes="100vw"
            />
            <figcaption className="mt-3 text-center text-sm text-white/80">{list[open].alt}</figcaption>
            <button onClick={() => setOpen((open - 1 + list.length) % list.length)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/20 px-3 py-2 text-2xl text-white hover:bg-white/30" aria-label="Anterior">‹</button>
            <button onClick={() => setOpen((open + 1) % list.length)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/20 px-3 py-2 text-2xl text-white hover:bg-white/30" aria-label="Próxima">›</button>
          </figure>
          <button onClick={() => setOpen(null)} className="absolute right-4 top-4 text-3xl text-white" aria-label="Fechar">×</button>
        </div>
      )}
    </div>
  );
}
