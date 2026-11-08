import Link from 'next/link';
import styled from 'styled-components';

/** The two components the cycle pages nest in opposite directions. A is defined first. */
export const A = styled.div`
  color: red;
`;

export const B = styled.div`
  color: blue;
`;

export function CycleLinks() {
  return (
    <nav style={{ display: 'flex', gap: 16 }}>
      <Link href="/scenarios/cycle-p">B rendered as A</Link>
      <Link href="/scenarios/cycle-q">A rendered as B</Link>
      <Link href="/scenarios/cycle-both">both nestings</Link>
    </nav>
  );
}
