import { A, B, CycleLinks } from '../cycle/defs';
import { RED, Scenario } from '../ui';

export default function Page() {
  return (
    <Scenario
      rows="S11"
      title="Cycle, page Q: A rendered as B (A is the outer)"
      expected="red (A wins) on a full load; after client navigation from page P, one of the two nestings loses and development warns once"
    >
      <CycleLinks />
      <A as={B} data-testid="probe" data-expected={RED}>
        probe
      </A>
    </Scenario>
  );
}
