import { useLayoutEffect, useRef } from 'react';

/**
 * The expression line (small, t3) over the big right-aligned result. The result starts at `size`
 * px and shrinks until it fits the width, so long numbers never clip or wrap.
 */
export default function Display({ expr, text, size, width, error }: { expr: string; text: string; size: number; width: number; error: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  // Measure at full size, then scale down to fit. Written straight to the node (not React state)
  // so a keypress costs one layout, not two renders.
  const base = error ? Math.round(size * 0.62) : size;
  useLayoutEffect(() => {
    const box = boxRef.current;
    const span = textRef.current;
    if (!box || !span) return;
    span.style.fontSize = `${base}px`;
    const need = span.scrollWidth;
    const avail = box.clientWidth;
    span.style.fontSize = `${need > avail && need > 0 ? Math.max(14, Math.floor((base * avail) / need)) : base}px`;
  }, [text, base, width]);

  return (
    <div className="shrink-0 px-3 pt-1 pb-2 flex flex-col items-stretch">
      <div className="h-5 text-right text-[14px] leading-5 text-t3 truncate select-text" title={expr}>
        {expr || ' '}
      </div>
      <div ref={boxRef} className="flex justify-end items-end overflow-hidden" style={{ height: Math.round(size * 1.3) }}>
        <span
          ref={textRef}
          aria-live="polite"
          className="font-display font-semibold text-t1 whitespace-nowrap leading-none pb-1 select-text"
        >
          {text}
        </span>
      </div>
    </div>
  );
}
