import type { ReactNode } from 'react';
import styled from 'styled-components';
import { ClientBase } from '../client-base';
import { BLUE, Scenario } from '../ui';

type PlainProps = { children?: ReactNode; className?: string };

const A = styled.div`
  color: red;
`;

function PlainServer({ children, className }: PlainProps) {
  return <A className={className}>{children}</A>;
}

function PlainClient({ children, className }: PlainProps) {
  return <ClientBase className={className}>{children}</ClientBase>;
}

// Each outer is defined after the component it reaches through a plain function.
const BServer = styled(PlainServer)`
  color: blue;
`;

const BClient = styled(PlainClient)`
  color: blue;
`;

export default function Page() {
  return (
    <Scenario
      rows="S4"
      title="Server B extends a plain function that renders a server or client inner"
      expected="blue on both"
    >
      <BServer data-testid="probe-server" data-expected={BLUE}>
        server inner
      </BServer>
      <BClient data-testid="probe-client" data-expected={BLUE}>
        client inner
      </BClient>
    </Scenario>
  );
}
