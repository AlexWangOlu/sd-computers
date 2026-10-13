import { useState } from 'react';
import { CornerLeftUp, ImageOff } from 'lucide-react';
import { t } from '@/i18n';
import { InfoBar } from '@/ui/controls';
import type { Block, Network, Site } from './types';
import { HOME, parentOf } from './model';
import { Column, SiteCard, openHandlers, type OpenFn } from './parts';

/** A picture by URL. One that does not load leaves a quiet placeholder, not a broken-image mark. */
function Picture({ src, caption }: { src: string; caption?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className="my-1">
      {failed ? (
        <div className="h-32 rounded-win border border-stroke bg-card flex flex-col items-center justify-center gap-2 text-t3">
          <ImageOff size={20} />
          <span className="text-caption">{t('ui.browser.image_missing')}</span>
        </div>
      ) : (
        <img
          src={src}
          alt={caption ?? ''}
          loading="lazy"
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => setFailed(true)}
          className="block max-w-full h-auto mx-auto rounded-win border border-stroke"
        />
      )}
      {caption && <figcaption className="mt-2 text-caption text-t3 text-center">{caption}</figcaption>}
    </figure>
  );
}

function BlockView({ block, net, onOpen }: { block: Block; net: Network; onOpen: OpenFn }) {
  switch (block.type) {
    case 'heading':
      return <h1 className="text-title font-semibold text-t1">{block.text}</h1>;
    case 'subheading':
      return <h2 className="mt-4 text-subtitle font-semibold text-t1">{block.text}</h2>;
    case 'text':
      return <p className="text-body leading-6 text-t2 whitespace-pre-line">{block.text}</p>;
    case 'list':
      return (
        <ul className="pl-5 list-disc marker:text-t3 text-body leading-6 text-t2 space-y-1">
          {block.items.map((item, i) => (
            <li key={i} className="pl-1">
              {item}
            </li>
          ))}
        </ul>
      );
    case 'notice':
      return (
        <div className="my-1">
          <InfoBar severity={block.kind} title={block.title}>
            {block.text}
          </InfoBar>
        </div>
      );
    case 'facts':
      return (
        <dl className="rounded-win border border-stroke bg-card text-body">
          {block.rows.map((row, i) => (
            <div key={i} className={`flex gap-4 px-4 py-2.5 ${i > 0 ? 'border-t border-stroke' : ''}`}>
              <dt className="w-[36%] shrink-0 text-t2">{row.label}</dt>
              <dd className="flex-1 min-w-0 text-t1 break-words">{row.value}</dd>
            </div>
          ))}
        </dl>
      );
    case 'links':
      return (
        <div className="flex flex-col gap-2">
          {block.items.map((link, i) => {
            // A link names a page by its address; one the network does not have still shows, and
            // leads to "can't be reached" like any dead link.
            const title = link.label ?? net.byAddress.get(link.to)?.title ?? (link.to === HOME ? t('ui.browser.start_page') : link.to);
            return <SiteCard key={i} title={title} detail={link.note ?? link.to} onOpen={newTab => onOpen(link.to, newTab)} />;
          })}
        </div>
      );
    case 'image':
      return <Picture src={block.src} caption={block.caption} />;
  }
}

/**
 * A built-in page: the config's blocks, top to bottom, in a reading column. The text is the server
 * owner's own and shown as written. A sub-page ('city.gov/permits') gets a way back up to the page
 * above it by itself, so a site of several pages needs no navigation written for it.
 */
export default function SitePage({ site, blocks, net, onOpen }: { site: Site; blocks: Block[]; net: Network; onOpen: OpenFn }) {
  const parent = parentOf(site.address, net);
  return (
    <Column>
      <article className="flex flex-col gap-4 select-text">
        {parent && (
          <button
            type="button"
            {...openHandlers(newTab => onOpen(parent.address, newTab))}
            className="self-start -ml-2 h-7 px-2 flex items-center gap-2 rounded-ctl text-caption text-accent-text hover:bg-subtle select-none"
          >
            <CornerLeftUp size={14} />
            {parent.title}
          </button>
        )}
        {blocks.map((block, i) => (
          <BlockView key={i} block={block} net={net} onOpen={onOpen} />
        ))}
      </article>
    </Column>
  );
}
