import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SPLITTER } from '../../constants';
import StyleSheet from '../../sheet';
import { idForGroup, resetGroupIds } from '../../sheet/GroupIDAllocator';
import { ScGlobalStyle, ScStyle, type ScStyleLevel, type ScStyleProps } from '../ScStyle';
import { StyleSheetManager } from '../StyleSheetManager';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const level = (id: string, name: string, color: string, seq: number): ScStyleLevel => [
  id,
  name,
  [`.${name}{color:${color};}`],
  seq,
];

const styleProps = (props: Partial<ScStyleProps> & Pick<ScStyleProps, 'chain'>): ScStyleProps => ({
  keyframes: [],
  outers: [],
  ...props,
});

let sheet: StyleSheet;
let host: HTMLElement;
let root: ReturnType<typeof createRoot>;

/** Each group of the sheet in output order, with the rules it holds as the browser serializes them. */
const groups = () =>
  sheet.order.positions.map(group => [
    idForGroup(group),
    sheet
      .getTag()
      .getGroup(group)
      .split(SPLITTER)
      .filter(rule => rule !== ''),
  ]);

const within = (...elements: React.ReactElement[]) => (
  <StyleSheetManager sheet={sheet}>
    {elements.map((element, index) => React.cloneElement(element, { key: index }))}
  </StyleSheetManager>
);

const mount = (...elements: React.ReactElement[]) => act(() => root.render(within(...elements)));

beforeEach(() => {
  resetGroupIds();
  sheet = new StyleSheet();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('ScStyle in the browser', () => {
  it('writes nothing while rendering, only when the render commits', () => {
    const element = <ScStyle {...styleProps({ chain: [level('a', 'x', 'red', 1)] })} />;

    renderToStaticMarkup(within(element));
    expect(groups()).toEqual([]);

    mount(element);
    expect(groups()).toEqual([['a', ['.x {color: red;}']]]);
  });

  it('writes a chain base first even when the extension was defined first', () => {
    mount(
      <ScStyle
        {...styleProps({
          chain: [level('base-id', 'b1', 'blue', 5), level('ext-id', 'e1', 'red', 2)],
        })}
      />
    );

    expect(groups()).toEqual([
      ['base-id', ['.b1 {color: blue;}']],
      ['ext-id', ['.e1 {color: red;}']],
    ]);
  });

  it('puts an outer after the component it wraps, though the outer was defined first', () => {
    mount(
      <ScStyle {...styleProps({ chain: [level('outer', 'o1', 'blue', 1)] })} />,
      <ScStyle
        {...styleProps({ chain: [level('inner', 'i1', 'red', 9)], outers: [['outer', 1]] })}
      />
    );

    expect(groups()).toEqual([
      ['inner', ['.i1 {color: red;}']],
      ['outer', ['.o1 {color: blue;}']],
    ]);
  });

  it('writes a new name when its props change and never repeats a name', () => {
    mount(<ScStyle {...styleProps({ chain: [level('a', 'x', 'red', 1)] })} />);
    mount(<ScStyle {...styleProps({ chain: [level('a', 'x', 'red', 1)] })} />);
    mount(<ScStyle {...styleProps({ chain: [level('a', 'y', 'blue', 1)] })} />);

    expect(groups()).toEqual([['a', ['.x {color: red;}', '.y {color: blue;}']]]);
  });

  it('leaves its rules in the sheet when it unmounts', () => {
    mount(<ScStyle {...styleProps({ chain: [level('a', 'x', 'red', 1)] })} />);
    mount();

    expect(groups()).toEqual([['a', ['.x {color: red;}']]]);
  });
});

describe('ScGlobalStyle in the browser', () => {
  const global = (id: string, rule: string) => (
    <ScGlobalStyle id={id} keyframes={[]} rules={[rule]} seq={1} />
  );

  it('writes its rules before every component when it mounts', () => {
    mount(
      <ScStyle {...styleProps({ chain: [level('a', 'x', 'red', 1)] })} />,
      global('sc-global-g', 'body{margin:0;}')
    );

    expect(groups()).toEqual([
      ['sc-global-g', ['body {margin: 0;}']],
      ['a', ['.x {color: red;}']],
    ]);
  });

  it('takes its rules out when it unmounts and leaves every component alone', () => {
    mount(
      <ScStyle {...styleProps({ chain: [level('a', 'x', 'red', 1)] })} />,
      global('sc-global-g', 'body{margin:0;}')
    );
    mount(<ScStyle {...styleProps({ chain: [level('a', 'x', 'red', 1)] })} />);

    expect(groups()).toEqual([
      ['sc-global-g', []],
      ['a', ['.x {color: red;}']],
    ]);
  });
});
