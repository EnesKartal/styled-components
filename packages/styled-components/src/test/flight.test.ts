import { readFlightPayload } from './flight';

/** Builds a payload from rows written as `id:json` lines, the way Flight writes its JSON rows. */
const payloadOf = (...rows: string[]): Buffer => Buffer.from(rows.map(row => `${row}\n`).join(''));

const probeProps = '{"className":"c","data-probe":"p"}';

describe('readFlightPayload', () => {
  it('finds a probe in a row after a path reference into the same row', () => {
    const result = readFlightPayload(
      payloadOf('0:["$1:0:3","$1"]', `1:[["$","div",null,${probeProps}]]`),
      []
    );

    expect(Object.keys(result.probes)).toEqual(['p']);
    expect(result.probes.p.row).toBe('1');
  });

  it('finds a probe in a row after a path reference to a whole row nested in it', () => {
    const result = readFlightPayload(
      payloadOf('0:["$1:0","$1"]', `1:[["$","div",null,${probeProps}]]`),
      []
    );

    expect(Object.keys(result.probes)).toEqual(['p']);
  });

  it('follows a row referenced twice once', () => {
    const result = readFlightPayload(
      payloadOf('0:["$1","$1"]', `1:[["$","div",null,${probeProps}]]`),
      []
    );

    expect(Object.keys(result.probes)).toEqual(['p']);
  });

  it('reads a payload whose rows reference each other in a cycle', () => {
    const result = readFlightPayload(
      payloadOf('0:["$1"]', `1:[["$","div",null,${probeProps}],"$2"]`, '2:["$1"]'),
      []
    );

    expect(Object.keys(result.probes)).toEqual(['p']);
  });
});
