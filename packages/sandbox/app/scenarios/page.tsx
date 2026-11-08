import Link from 'next/link';

/** Plan rows are the scenario numbers in the server component order spec (docs/react.md). */
const routes = [
  { href: 'chain', rows: 'S1', what: 'server B extends server A' },
  { href: 'server-over-client', rows: 'S2', what: 'server B extends a client component' },
  { href: 'as-client', rows: 'S3a', what: 'server B rendered as a client component' },
  { href: 'as-server', rows: 'S3b, S5', what: 'server B rendered as server A, B defined first' },
  { href: 'client-as', rows: 'S3c, S5', what: 'client B rendered as client A, B defined first' },
  {
    href: 'plain-intermediate',
    rows: 'S4',
    what: 'outer reaches its inner through a plain function',
  },
  { href: 'lazy-inner', rows: 'S6', what: 'inner module first loaded in the browser' },
  { href: 'late-boundary', rows: 'S7', what: 'B in the shell, A in a late boundary' },
  { href: 'late-unrelated', rows: 'S8a', what: 'unrelated component in a late boundary' },
  { href: 'late-new-name', rows: 'S8b', what: 'late instance mints a new generated name' },
  { href: 'streaming', rows: 'S8c, S26, cost', what: 'late client boundaries and late globals' },
  { href: 'svg', rows: 'S9', what: 'SVG children with child-index selectors' },
  { href: 'sibling', rows: 'S10', what: 'adjacent-sibling selector on list items' },
  { href: 'cycle-p', rows: 'S11', what: 'cycle, B rendered as A' },
  { href: 'cycle-q', rows: 'S11', what: 'cycle, A rendered as B' },
  { href: 'cycle-both', rows: 'S11', what: 'cycle, both nestings on one page' },
  { href: 'globals', rows: 'S13, S25', what: 'globals against components' },
  { href: 'nested-wrappers', rows: 'S16', what: 'three levels through plain functions' },
  { href: 'late-edge', rows: 'S20', what: 'two flushed groups related by a late boundary' },
  { href: 'nested-manager', rows: 'S23', what: 'managers with a nonce or a target' },
  { href: 'layers', rows: 'S24', what: 'layer order without an up-front statement' },
  { href: 'layers-declared', rows: 'S24', what: 'layer order with an up-front statement' },
  { href: 'late-child-selector', rows: 'S27', what: 'parent child-selector against a late child' },
  { href: 'many-instances', rows: 'cost', what: '5,000 server instances of 50 components' },
];

export default function Page() {
  return (
    <div>
      <h1 style={{ fontSize: 20 }}>Style order scenarios</h1>
      <p style={{ fontSize: 14 }}>
        Each page marks the elements to check with <code>data-expected</code>, the computed value
        the element must have.
      </p>
      <ul style={{ fontSize: 14, lineHeight: 1.8 }}>
        {routes.map(route => (
          <li key={route.href}>
            <Link href={`/scenarios/${route.href}`}>{route.href}</Link> ({route.rows}): {route.what}
          </li>
        ))}
      </ul>
    </div>
  );
}
