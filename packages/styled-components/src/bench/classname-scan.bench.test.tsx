/**
 * Cost of a styled render that receives a `className` (the scan for outer styled components), in an
 * app with no wrapped components, where nothing the scan finds is ever an outer.
 *
 * Each row updates 1,000 mounted items one update at a time, so every update re-renders every item
 * and the sheet already holds each item's rules (no injector mounts). Rows:
 *
 * - 0 tokens: no `className` at all.
 * - 5 and 30 tokens, cache-friendly: every item receives one fixed string.
 * - 5 and 30 tokens, worst case: every item receives a string unique to the item and the update, so
 *   a cache of past strings never hits.
 *
 * The figures to compare across trees are the minimum and the median of the runs, in ms per 1,000
 * items (each update renders 1,000 items); ns per render is that figure times 1,000. The minimum is
 * the steadier of the two on a loaded machine.
 *
 * Run: pnpm --filter styled-components bench:web -- classname-scan
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { performance } from 'perf_hooks';
import styled from '../index';

const ITEMS = 1000;
const UPDATES = 20;
const RUNS = 21;

const Item = styled.div`
  color: red;
`;

const tokens = (count: number, prefix: string) =>
  Array.from({ length: count }, (_, index) => `${prefix}${index}`).join(' ');

type Row = {
  name: string;
  classNameFor: ((update: number, item: number) => string) | undefined;
};

const rows: Row[] = [
  { name: '0 tokens', classNameFor: undefined },
  ...[5, 30].flatMap(count => {
    const fixed = tokens(count, 'util-');
    const tail = tokens(count - 1, 'tail-');

    return [
      { name: `${count} tokens, cache-friendly`, classNameFor: () => fixed },
      {
        name: `${count} tokens, worst case (unique per item and update)`,
        classNameFor: (update: number, item: number) => `u${update}x${item} ${tail}`,
      },
    ];
  }),
];

describe('className scan', () => {
  it('renders 1,000 items per update', () => {
    console.log(`\nclassName scan, ${ITEMS} items per update, ${RUNS} runs`);

    for (const { name, classNameFor } of rows) {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const root = createRoot(host);
      let update = 0;

      const List = ({ tick }: { tick: number }) => {
        const items: React.ReactNode[] = [];
        for (let item = 0; item < ITEMS; item++) {
          items.push(
            <Item
              key={item}
              data-tick={tick}
              className={classNameFor === undefined ? undefined : classNameFor(tick, item)}
            />
          );
        }
        return <>{items}</>;
      };
      const step = () => {
        const tick = update++;
        flushSync(() => root.render(<List tick={tick} />));
      };

      for (let warm = 0; warm < 10; warm++) step();

      const samples: number[] = [];
      for (let run = 0; run < RUNS; run++) {
        const start = performance.now();
        for (let i = 0; i < UPDATES; i++) step();
        samples.push((performance.now() - start) / UPDATES);
      }

      samples.sort((a, b) => a - b);
      const median = samples[Math.floor(RUNS / 2)];
      const minimum = samples[0];
      console.log(
        `  ${name.padEnd(56)} min ${minimum.toFixed(2).padStart(6)}  median ${median.toFixed(2).padStart(6)} ms per 1,000 items  (min ${((minimum * 1e6) / ITEMS).toFixed(0).padStart(5)} ns per render)`
      );

      root.unmount();
      host.remove();
    }
  });
});
