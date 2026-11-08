import { A, B, CycleLinks } from '../cycle/defs';
import { BLUE, Scenario } from '../ui';

export default function Page() {
  return (
    <Scenario
      rows="S11"
      title="Cycle, both nestings on one page"
      expected="the nesting whose outer is defined later (B) wins; the other loses"
    >
      <CycleLinks />
      <B as={A} data-testid="probe-b-outer" data-expected={BLUE}>
        B rendered as A
      </B>
      <A as={B} data-testid="probe-a-outer">
        A rendered as B (loses to key order)
      </A>
    </Scenario>
  );
}
