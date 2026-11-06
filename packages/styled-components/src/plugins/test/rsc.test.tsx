import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import React from 'react';
import { resetStyled } from '../../test/utils';
import { StyleSheetManager } from '../../models/StyleSheetManager';
import rscPlugin from '../rsc';
import { rewriteSelectorForRSC } from '../rscSelectorRewrite';

let styled: ReturnType<typeof resetStyled>;

describe('rscPlugin', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    styled = resetStyled(true);
  });

  function getInjectedCSS(): string {
    // CSSOM-injected rules don't appear in textContent;walk the live sheet.
    return Array.from(document.querySelectorAll<HTMLStyleElement>('style[data-styled]'))
      .map(el => {
        if (el.sheet && el.sheet.cssRules.length) {
          return Array.from(el.sheet.cssRules)
            .map(r => r.cssText)
            .join('');
        }
        return el.textContent || '';
      })
      .join('');
  }

  it('drops a rule whose rewritten selector stops reading as one rule', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const Item = styled.li`
      ${() => 'url(:first-child{}html{display:none})'} {
        top: 0;
      }
    `;

    render(
      <StyleSheetManager plugins={[rscPlugin]}>
        <Item />
      </StyleSheetManager>
    );

    expect(getInjectedCSS()).toEqual('');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('should rewrite :first-child', () => {
    const Item = styled.li`
      &:first-child {
        color: red;
      }
    `;

    render(
      <StyleSheetManager plugins={[rscPlugin]}>
        <ul>
          <Item>First</Item>
        </ul>
      </StyleSheetManager>
    );

    expect(getInjectedCSS()).toMatchInlineSnapshot(
      `".b:nth-child(1 of :not(style[data-styled])) {color: red;}"`
    );
  });

  it('should rewrite :last-child', () => {
    const Item = styled.li`
      &:last-child {
        color: blue;
      }
    `;

    render(
      <StyleSheetManager plugins={[rscPlugin]}>
        <ul>
          <Item>Last</Item>
        </ul>
      </StyleSheetManager>
    );

    expect(getInjectedCSS()).toMatchInlineSnapshot(
      `".b:nth-last-child(1 of :not(style[data-styled])) {color: blue;}"`
    );
  });

  it('should rewrite :nth-child(N)', () => {
    const Item = styled.li`
      &:nth-child(2) {
        color: green;
      }
    `;

    render(
      <StyleSheetManager plugins={[rscPlugin]}>
        <ul>
          <Item>Second</Item>
        </ul>
      </StyleSheetManager>
    );

    expect(getInjectedCSS()).toMatchInlineSnapshot(
      `".b:nth-child(2 of :not(style[data-styled])) {color: green;}"`
    );
  });

  it('should rewrite :nth-last-child(N)', () => {
    const Item = styled.li`
      &:nth-last-child(2) {
        color: purple;
      }
    `;

    render(
      <StyleSheetManager plugins={[rscPlugin]}>
        <ul>
          <Item>Item</Item>
        </ul>
      </StyleSheetManager>
    );

    expect(getInjectedCSS()).toMatchInlineSnapshot(
      `".b:nth-last-child(2 of :not(style[data-styled])) {color: purple;}"`
    );
  });

  it('should rewrite An+B formulas', () => {
    const Item = styled.li`
      &:nth-child(2n + 1) {
        background: gray;
      }
    `;

    render(
      <StyleSheetManager plugins={[rscPlugin]}>
        <ul>
          <Item>Odd</Item>
        </ul>
      </StyleSheetManager>
    );

    expect(getInjectedCSS()).toMatchInlineSnapshot(
      `".b:nth-child(2n + 1 of :not(style[data-styled])) {background: gray;}"`
    );
  });

  it('should rewrite keyword arguments (odd, even)', () => {
    const Item = styled.li`
      &:nth-child(odd) {
        background: #eee;
      }
      &:nth-child(even) {
        background: #fff;
      }
    `;

    render(
      <StyleSheetManager plugins={[rscPlugin]}>
        <ul>
          <Item>Item</Item>
        </ul>
      </StyleSheetManager>
    );

    expect(getInjectedCSS()).toMatchInlineSnapshot(
      `".b:nth-child(odd of :not(style[data-styled])) {background: #eee;}.b:nth-child(even of :not(style[data-styled])) {background: #fff;}"`
    );
  });

  it('should not double-rewrite selectors already using of syntax', () => {
    const Item = styled.li`
      &:nth-child(2 of .special) {
        color: gold;
      }
    `;

    render(
      <StyleSheetManager plugins={[rscPlugin]}>
        <ul>
          <Item>Item</Item>
        </ul>
      </StyleSheetManager>
    );

    expect(getInjectedCSS()).toMatchInlineSnapshot(`".b:nth-child(2 of .special) {color: gold;}"`);
  });

  it('should handle multiple pseudo-classes on the same selector', () => {
    const Item = styled.li`
      &:first-child,
      &:last-child {
        font-weight: bold;
      }
    `;

    render(
      <StyleSheetManager plugins={[rscPlugin]}>
        <ul>
          <Item>Item</Item>
        </ul>
      </StyleSheetManager>
    );

    expect(getInjectedCSS()).toMatchInlineSnapshot(
      `".b:nth-child(1 of :not(style[data-styled])),.b:nth-last-child(1 of :not(style[data-styled])) {font-weight: bold;}"`
    );
  });

  it('should not touch selectors without child-index pseudo-classes', () => {
    const Button = styled.button`
      &:hover {
        color: red;
      }
      &:focus {
        outline: 2px solid blue;
      }
      &:first-of-type {
        margin-left: 0;
      }
    `;

    render(
      <StyleSheetManager plugins={[rscPlugin]}>
        <Button>Click</Button>
      </StyleSheetManager>
    );

    expect(getInjectedCSS()).toMatchInlineSnapshot(
      `".b:hover {color: red;}.b:focus {outline: 2px solid blue;}.b:first-of-type {margin-left: 0;}"`
    );
  });

  it('should not affect styles when plugin is not used', () => {
    const Item = styled.li`
      &:first-child {
        color: red;
      }
    `;

    render(
      <ul>
        <Item>First</Item>
      </ul>
    );

    expect(getInjectedCSS()).toMatchInlineSnapshot(`".b:first-child {color: red;}"`);
  });

  it('should rewrite :first-child inside a media query', () => {
    const Item = styled.li`
      @media (min-width: 768px) {
        &:first-child {
          color: red;
        }
      }
    `;

    render(
      <StyleSheetManager plugins={[rscPlugin]}>
        <ul>
          <Item>First</Item>
        </ul>
      </StyleSheetManager>
    );

    expect(getInjectedCSS()).toMatchInlineSnapshot(
      `"@media (min-width: 768px) {.b:nth-child(1 of :not(style[data-styled])) {color: red;}}"`
    );
  });

  it('should rewrite :first-child in a nested parent selector', () => {
    const Item = styled.li`
      .parent &:first-child {
        color: red;
      }
    `;

    render(
      <StyleSheetManager plugins={[rscPlugin]}>
        <ul>
          <Item>First</Item>
        </ul>
      </StyleSheetManager>
    );

    expect(getInjectedCSS()).toMatchInlineSnapshot(
      `".parent .b:nth-child(1 of :not(style[data-styled])) {color: red;}"`
    );
  });

  it('should rewrite :first-child in compound pseudo-class selectors', () => {
    const Item = styled.li`
      &:first-child:hover {
        color: red;
      }
      &:not(.foo):nth-child(2) {
        color: blue;
      }
    `;

    render(
      <StyleSheetManager plugins={[rscPlugin]}>
        <ul>
          <Item>First</Item>
        </ul>
      </StyleSheetManager>
    );

    expect(getInjectedCSS()).toMatchInlineSnapshot(
      `".b:nth-child(1 of :not(style[data-styled])):hover {color: red;}.b:not(.foo):nth-child(2 of :not(style[data-styled])) {color: blue;}"`
    );
  });

  it('should rewrite negative An+B formulas', () => {
    const Item = styled.li`
      &:nth-child(-n + 3) {
        color: red;
      }
    `;

    render(
      <StyleSheetManager plugins={[rscPlugin]}>
        <ul>
          <Item>First</Item>
        </ul>
      </StyleSheetManager>
    );

    expect(getInjectedCSS()).toMatchInlineSnapshot(
      `".b:nth-child(-n + 3 of :not(style[data-styled])) {color: red;}"`
    );
  });

  it('should rewrite bare numeric :nth-child(3)', () => {
    const Item = styled.li`
      &:nth-child(3) {
        color: red;
      }
    `;

    render(
      <StyleSheetManager plugins={[rscPlugin]}>
        <ul>
          <Item>First</Item>
        </ul>
      </StyleSheetManager>
    );

    expect(getInjectedCSS()).toMatchInlineSnapshot(
      `".b:nth-child(3 of :not(style[data-styled])) {color: red;}"`
    );
  });

  it('should rewrite :only-child', () => {
    const Item = styled.li`
      &:only-child {
        color: red;
      }
    `;

    render(
      <StyleSheetManager plugins={[rscPlugin]}>
        <ul>
          <Item>Only</Item>
        </ul>
      </StyleSheetManager>
    );

    expect(getInjectedCSS()).toMatchInlineSnapshot(
      `".b:nth-child(1 of :not(style[data-styled])):nth-last-child(1 of :not(style[data-styled])) {color: red;}"`
    );
  });

  it('should handle multiple components with different selectors in the same StyleSheetManager', () => {
    const First = styled.li`
      &:first-child {
        color: red;
      }
    `;
    const Last = styled.li`
      &:last-child {
        color: blue;
      }
    `;
    const Hover = styled.li`
      &:hover {
        color: green;
      }
    `;

    render(
      <StyleSheetManager plugins={[rscPlugin]}>
        <ul>
          <First>First</First>
          <Last>Last</Last>
          <Hover>Hover</Hover>
        </ul>
      </StyleSheetManager>
    );

    expect(getInjectedCSS()).toMatchInlineSnapshot(
      `".d:nth-child(1 of :not(style[data-styled])) {color: red;}.e:nth-last-child(1 of :not(style[data-styled])) {color: blue;}.f:hover {color: green;}"`
    );
  });

  it('should have a name property for hash computation', () => {
    expect(rscPlugin.name).toBe('rsc');
  });

  // The `+` combinator is handled by the emitter in server component output, not by the plugin.
  describe('adjacent sibling combinator (+)', () => {
    it('leaves + alone and still rewrites a child-index pseudo on the same selector', () => {
      const Item = styled.div`
        & + &:first-child {
          color: red;
        }
      `;

      render(
        <StyleSheetManager plugins={[rscPlugin]}>
          <Item>A</Item>
        </StyleSheetManager>
      );

      expect(getInjectedCSS()).toMatchInlineSnapshot(
        `".b+.b:nth-child(1 of :not(style[data-styled])) {color: red;}"`
      );
    });

    it('leaves a selector with + but no child-index pseudo as it was', () => {
      const Item = styled.div`
        .item + & {
          color: red;
        }
      `;

      render(
        <StyleSheetManager plugins={[rscPlugin]}>
          <Item>A</Item>
        </StyleSheetManager>
      );

      expect(getInjectedCSS()).toMatchInlineSnapshot(`".item+.b {color: red;}"`);
    });

    it.each<[string, string, string]>([
      ['a chain', '.a+.b+.c', '.a+.b+.c'],
      ['a long chain', 'a+'.repeat(4000) + 'b', 'a+'.repeat(4000) + 'b'],
      ['an escaped plus', '.a\\+b+.c', '.a\\+b+.c'],
      ['a plus in an attribute value', "[href*='a+b']+.c", "[href*='a+b']+.c"],
      [
        'a plus in An+B and as a combinator',
        ':nth-child(2n+1)+:nth-child(3n+2)',
        ':nth-child(2n+1 of :not(style[data-styled]))+:nth-child(3n+2 of :not(style[data-styled]))',
      ],
      [
        'a list',
        ':first-child+.a,.b+:last-child',
        ':nth-child(1 of :not(style[data-styled]))+.a,.b+:nth-last-child(1 of :not(style[data-styled]))',
      ],
    ])('rewriteSelectorForRSC keeps %s as one selector', (_label, selector, expected) => {
      expect(rewriteSelectorForRSC(selector)).toBe(expected);
    });
  });
});
