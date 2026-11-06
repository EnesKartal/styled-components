import type { EmitOptions } from './emit-web';
import { emitWeb } from './emit-web';
import { parse, wrapAst } from './parser';
import { normalize } from '../utils/compiler';
import { resetWarnOnce } from '../utils/warnOnce';

/** `emitWeb` as a server component build loads it: `IS_RSC` is fixed when the module loads. */
function loadRscEmitWeb(): typeof emitWeb {
  let loaded: typeof emitWeb | undefined;

  jest.isolateModules(() => {
    jest.doMock('../utils/isRsc', () => ({ IS_RSC: true }));
    loaded = require('./emit-web').emitWeb;
  });
  jest.dontMock('../utils/isRsc');

  if (!loaded) throw new Error('emit-web did not load');
  return loaded;
}

function emit(css: string, selector = '.a'): string[] {
  return emitWeb(parse(normalize(css)), selector);
}

describe('web emitter', () => {
  it('emits simple declarations', () => {
    expect(emit(`color: red; background: blue;`)).toMatchInlineSnapshot(`
      [
        ".a{color:red;background:blue;}",
      ]
    `);
  });

  it('collapses non-contiguous base decls into one rule', () => {
    expect(emit(`color: red; &:hover { color: blue; } font-size: 16px;`)).toMatchInlineSnapshot(`
      [
        ".a{color:red;font-size:16px;}",
        ".a:hover{color:blue;}",
      ]
    `);
  });

  it('handles multiple nested rules inside @media', () => {
    expect(
      emit(`@media (min-width: 500px) { &:hover { a: 1; } &:focus { b: 2; } }`)
    ).toMatchInlineSnapshot(`
      [
        "@media (min-width: 500px){.a:hover{a:1;}.a:focus{b:2;}}",
      ]
    `);
  });

  it('handles @media with mixed base decl + nested rule', () => {
    expect(
      emit(`@media (min-width: 500px) { background: red; &:hover { color: blue; } }`)
    ).toMatchInlineSnapshot(`
      [
        "@media (min-width: 500px){.a{background:red;}.a:hover{color:blue;}}",
      ]
    `);
  });

  it('emits @keyframes preserving frame stops', () => {
    expect(
      emit(`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`)
    ).toMatchInlineSnapshot(`
      [
        "@keyframes spin{from{transform:rotate(0);}to{transform:rotate(360deg);}}",
      ]
    `);
  });

  it('prepends parent-space for bare (non-&) nested selectors', () => {
    expect(
      emit(`color: red; .foo { color: blue; } .bar .baz { padding: 8px; }`)
    ).toMatchInlineSnapshot(`
      [
        ".a{color:red;}",
        ".a .foo{color:blue;}",
        ".a .bar .baz{padding:8px;}",
      ]
    `);
  });

  it('joins comma-separated nested selectors', () => {
    expect(emit(`&:hover, &:focus { color: blue; }`)).toMatchInlineSnapshot(`
      [
        ".a:hover,.a:focus{color:blue;}",
      ]
    `);
  });

  it('nests at-rules (@media inside @supports)', () => {
    expect(
      emit(`@supports (display: grid) { @media (min-width: 500px) { &:hover { display: grid; } } }`)
    ).toMatchInlineSnapshot(`
      [
        "@supports (display: grid){@media (min-width: 500px){.a:hover{display:grid;}}}",
      ]
    `);
  });

  it('emits @font-face with bare declarations (no selector wrap)', () => {
    expect(emit(`@font-face { font-family: 'Foo'; src: url(foo.woff2); }`)).toMatchInlineSnapshot(`
      [
        "@font-face{font-family:'Foo';src:url(foo.woff2);}",
      ]
    `);
  });

  /**
   * CSS View Transitions 2 §8.3.1 (https://drafts.csswg.org/css-view-transitions-2/#view-transition-rule):
   * "@view-transition { <declaration-list> }" ... "The @view-transition rule accepts the navigation
   * and types descriptors." ... "the @view-transition rule can be nested inside a conditional group
   * rule such as @media or @supports."
   *
   * CSS Anchor Positioning 1 §6.4 (https://drafts.csswg.org/css-anchor-position-1/#fallback-rule):
   * "@position-try <dashed-ident> { <declaration-list> }" ... "The @position-try rule only accepts
   * the following accepted @position-try properties".
   *
   * Neither body holds a style rule, so it is emitted as written, never wrapped in the parent
   * selector, and kept when there is no parent selector (a global style).
   */
  describe('at-rules whose body is a declaration list', () => {
    test.each([
      ['a component', '.a'],
      ['a global style', ''],
    ])('emits @view-transition and @position-try as written in %s', (_, selector) => {
      expect(
        emit(
          `@view-transition { navigation: auto; types: slide forwards; }
           @position-try --below { top: anchor(bottom); position-area: bottom; }`,
          selector
        )
      ).toEqual([
        '@view-transition{navigation:auto;types:slide forwards;}',
        '@position-try --below{top:anchor(bottom);position-area:bottom;}',
      ]);
    });

    it('emits @view-transition nested in @media in a global style', () => {
      expect(
        emit(
          `@media (prefers-reduced-motion: no-preference) { @view-transition { navigation: auto; } }`,
          ''
        )
      ).toEqual([
        '@media (prefers-reduced-motion: no-preference){@view-transition{navigation:auto;}}',
      ]);
    });

    /**
     * CSS Paged Media 3 §3 (https://drafts.csswg.org/css-page-3/#syntax-page-selector):
     * "@page = @page <page-selector-list>? { <declaration-rule-list> }" ...
     * "@top-left = @top-left { <declaration-list> };" ... "The @page rule can only contain page
     * properties and margin at-rules."
     *
     * CSS Fonts 4 (https://drafts.csswg.org/css-fonts-4/#font-feature-values):
     * "@font-feature-values = @font-feature-values <font-family-name># { <declaration-rule-list> }"
     * ... "@styleset = @styleset { <declaration-list> }" ... "The @font-feature-values block
     * accepts <declaration-rule-list> as its contents; these list items are either: at-rules named
     * by one of the <font-feature-value-type> at-keyword tokens or the font-display descriptor."
     */
    test.each([
      ['a component', '.a'],
      ['a global style', ''],
    ])(
      'keeps the declaration blocks nested in @page and @font-feature-values in %s',
      (_, selector) => {
        expect(
          emit(
            `@page :first { margin: 1cm; @top-left { content: "Title"; } }
           @font-feature-values Font One { font-display: swap; @styleset { nice-style: 12; } }`,
            selector
          )
        ).toEqual([
          '@page :first{margin:1cm;@top-left{content:"Title";}}',
          '@font-feature-values Font One{font-display:swap;@styleset{nice-style:12;}}',
        ]);
      }
    );
  });

  it('drops empty nested rules but keeps base decls', () => {
    expect(emit(`color: red; &:hover { } font-size: 16px;`)).toMatchInlineSnapshot(`
      [
        ".a{color:red;font-size:16px;}",
      ]
    `);
  });

  it('emits @import block-less', () => {
    expect(emit(`@import url(https://example.com/styles.css); color: red;`)).toMatchInlineSnapshot(`
      [
        ".a{color:red;}",
        "@import url(https://example.com/styles.css);",
      ]
    `);
  });

  it('preserves quoted content values', () => {
    expect(emit(`content: "}"; color: red;`)).toMatchInlineSnapshot(`
      [
        ".a{content:"}";color:red;}",
      ]
    `);
  });

  it('emits @container', () => {
    expect(
      emit(`@container card (min-width: 400px) { padding: 16px; &:hover { padding: 24px; } }`)
    ).toMatchInlineSnapshot(`
      [
        "@container card (min-width: 400px){.a{padding:16px;}.a:hover{padding:24px;}}",
      ]
    `);
  });

  it('emits @layer block-less (layer order declaration)', () => {
    expect(emit(`@layer reset, framework, utilities;`)).toMatchInlineSnapshot(`
      [
        "@layer reset,framework,utilities;",
      ]
    `);
  });

  it('emits @layer block', () => {
    expect(emit(`@layer utilities { color: red; }`)).toMatchInlineSnapshot(`
      [
        "@layer utilities{.a{color:red;}}",
      ]
    `);
  });

  // CSS Nesting: "A selector is said to contain the nesting selector if, when it was
  // parsed as any type of selector, a <delim-token> with the value "&" (U+0026
  // AMPERSAND) was encountered." An escaped `&` or one in a string is no delim-token.
  it.each([
    ['an escaped `&` beside a real one', '&.\\[\\&\\>\\*\\]', '.a.\\[\\&\\>\\*\\]'],
    ['an escaped `&` alone', '.\\[\\&\\>\\*\\]', '.a .\\[\\&\\>\\*\\]'],
    ['a double-quoted `&`', '&[b="&"]', '.a[b="&"]'],
    ['a single-quoted `&`', "&[b='&']", ".a[b='&']"],
    ['a `&` after an escaped quote in a string', '&[b="\\"&"]', '.a[b="\\"&"]'],
    ['a `&` in a string alone', '[b="&"]', '.a [b="&"]'],
    ['an escaped `&` inside a function', ':is(&,.\\&b)', ':is(.a,.\\&b)'],
    ['a real `&` after an escaped backslash', '.b\\\\&', '.b\\\\.a'],
  ])('replaces only the real `&` with %s', (_label, selector, resolved) => {
    expect(emit(`${selector} { c: d; }`)).toEqual([`${resolved}{c:d;}`]);
  });

  it('keeps a parent holding replacement patterns verbatim beside a string', () => {
    expect(emit('&[b="c"] { d: e; }', '.x$&y')).toEqual(['.x$&y[b="c"]{d:e;}']);
  });

  it('handles nested & + & self-reference (combinator spaces stripped)', () => {
    expect(emit(`& + & { margin-left: 8px; }`)).toMatchInlineSnapshot(`
      [
        ".a+.a{margin-left:8px;}",
      ]
    `);
  });

  it('rewrites & + & to a withConfig componentId verbatim, even one holding replacement patterns', () => {
    const root = parse(normalize(`& + & { margin-left: 8px; }`));
    expect(emitWeb(root, '.a', { componentId: 'x$&y', selfRefSelector: '.a' })).toEqual([
      '.x$&y+.x$&y{margin-left:8px;}',
    ]);
  });

  describe('container auto-name', () => {
    const options: EmitOptions = { componentId: 'sc-id' };

    it('names the container a root declaration makes', () => {
      expect(emitWeb(parse('container-type: size;'), '.a', options)).toEqual([
        '.a{container-type:size;container-name:sc-id;}',
      ]);
    });

    // Each of these writes to the component's own element, the one `${Component}` names.
    it.each([
      [
        '`&`',
        '& { container-type: size; }',
        ['.a{container-name:sc-id;}', '.a{container-type:size;}'],
      ],
      [
        '`&&`',
        '&& { container-type: size; }',
        ['.a{container-name:sc-id;}', '.a.a{container-type:size;}'],
      ],
      [
        '`&, &`',
        '&, & { container-type: size; }',
        ['.a{container-name:sc-id;}', '.a,.a{container-type:size;}'],
      ],
      [
        '`&` inside `&`',
        '& { & { container-type: size; } }',
        ['.a{container-name:sc-id;}', '.a{container-type:size;}'],
      ],
      [
        '`&` beside a root declaration',
        'color: red; & { container-type: size; }',
        ['.a{color:red;container-name:sc-id;}', '.a{container-type:size;}'],
      ],
      [
        '`&` beside another rule',
        '& { container-type: size; } h1 { top: 0; }',
        ['.a{container-name:sc-id;}', '.a{container-type:size;}', '.a h1{top:0;}'],
      ],
    ])('names the container a rule on %s makes', (_label, css, rules) => {
      expect(emitWeb(parse(css), '.a', options)).toEqual(rules);
    });

    it.each([
      ['a pseudo-class', '&:hover { container-type: size; }', '.a:hover{container-type:size;}'],
      ['a descendant', '& .x { container-type: size; }', '.a .x{container-type:size;}'],
      ['`& &`', '& & { container-type: size; }', '.a .a{container-type:size;}'],
      [
        'a list with another element',
        '&, .x { container-type: size; }',
        '.a,.a .x{container-type:size;}',
      ],
      [
        'an at-rule',
        '@media print { & { container-type: size; } }',
        '@media print{.a{container-type:size;}}',
      ],
    ])('leaves a rule on %s unnamed', (_label, css, expected) => {
      expect(emitWeb(parse(css), '.a', options)).toEqual([expected]);
    });

    it.each([
      [
        'its own name on `&`',
        '& { container-type: size; container-name: x; }',
        ['.a{container-type:size;container-name:x;}'],
      ],
      [
        'a name on `&` beside a root type',
        'container-type: size; & { container-name: x; }',
        ['.a{container-type:size;}', '.a{container-name:x;}'],
      ],
      ['the normal type on `&`', '& { container-type: normal; }', ['.a{container-type:normal;}']],
    ])('adds no name for %s', (_label, css, expected) => {
      expect(emitWeb(parse(css), '.a', options)).toEqual(expected);
    });

    it.each([
      ['a nested rule', '.child { container-type: size; }', '.a .child{container-type:size;}'],
      [
        'a nested rule beside a sibling',
        '.child { container-type: size; } .other { top: 0; }',
        '.a .child{container-type:size;}',
      ],
    ])('leaves %s unnamed', (_label, css, expected) => {
      expect(emitWeb(parse(css), '.a', options)[0]).toBe(expected);
    });

    it('leaves a wrapped root unnamed', () => {
      expect(emitWeb(wrapAst(parse('container-type: size;'), '.a'), '', options)).toEqual([
        '.a{container-type:size;}',
      ]);
    });

    it.each([
      [
        'an explicit name',
        'container-type: size; container-name: x;',
        '.a{container-type:size;container-name:x;}',
      ],
      [
        'a name spelled like the normal type',
        'container-type: size; container-name: normal;',
        '.a{container-type:size;container-name:normal;}',
      ],
      ['the normal type', 'container-type: normal;', '.a{container-type:normal;}'],
    ])('adds nothing beside %s', (_label, css, expected) => {
      expect(emitWeb(parse(css), '.a', options)).toEqual([expected]);
    });
  });

  describe('parent comma-cross-product respects pseudo-fn parens (#4279)', () => {
    // When the outer selector contains a `,` INSIDE :is()/:where()/:has(),
    // child rules must NOT split that comma as if it were a top-level
    // selector boundary. Bug: parser was doing naive `.split(',')` on the
    // resolved parent selector for child cross-product, splitting :is(...)
    // contents in half and producing nonsense like `.a:hover .grandchild`.
    it('does not split commas inside :is() during child cross-product', () => {
      const out = emit(
        `:is(&:hover, .parent:hover &) .child {
          color: red;
          .grandchild { color: blue; }
        }`
      );
      // The parent `:is(...)` must stay intact in the grandchild rule.
      // Pre-fix bug: the second rule was producing
      // `:is(.a:hover .grandchild, .parent:hover .a) .child .grandchild`
      // (the `.grandchild` got incorrectly injected INTO the first :is arm).
      expect(out).toMatchInlineSnapshot(`
        [
          ":is(.a:hover, .parent:hover .a) .child{color:red;}",
          ":is(.a:hover, .parent:hover .a) .child .grandchild{color:blue;}",
        ]
      `);
    });

    it('does not split commas inside :where() during child cross-product', () => {
      const out = emit(`:where(&, & + &) .child { .nested { color: red; } }`);
      expect(out).toMatchInlineSnapshot(`
        [
          ":where(.a, .a + .a) .child .nested{color:red;}",
        ]
      `);
    });

    it('does not split commas inside :has() during child cross-product', () => {
      const out = emit(`:has(.x, .y) {
        color: red;
        .nested { color: blue; }
      }`);
      expect(out).toMatchInlineSnapshot(`
        [
          ".a :has(.x, .y){color:red;}",
          ".a :has(.x, .y) .nested{color:blue;}",
        ]
      `);
    });

    it('does not split commas inside [attr*="a,b"] during child cross-product', () => {
      const out = emit(`&[data-x*="a,b"] {
        color: red;
        .nested { color: blue; }
      }`);
      expect(out).toMatchInlineSnapshot(`
        [
          ".a[data-x*="a,b"]{color:red;}",
          ".a[data-x*="a,b"] .nested{color:blue;}",
        ]
      `);
    });

    it('still cross-products on TOP-LEVEL parent commas', () => {
      // Sanity: comma OUTSIDE pseudo-fn parens still produces cross-product
      // (this is the case the existing logic was designed for). The bare
      // `.b` selector gets the styled-component selector prepended via
      // parent-space, so it becomes `.a .b`.
      const out = emit(`&, .b { .nested { color: red; } }`);
      expect(out).toMatchInlineSnapshot(`
        [
          ".a .nested,.a .b .nested{color:red;}",
        ]
      `);
    });
  });

  describe('every rule it returns reads as one rule', () => {
    // https://drafts.csswg.org/css-syntax/#consume-qualified-rule
    const rewriteColor = (value: string): EmitOptions => ({
      decl: (prop, authored) => ({ prop, value: prop === 'color' ? value : authored }),
    });

    it.each<[string, string, EmitOptions, string[]]>([
      [
        'a declaration rewrite that closes its block',
        'color: red; top: 0;',
        rewriteColor('x}html{display:none}a{b:y'),
        ['.a{top:0;}'],
      ],
      ['a declaration rewrite that opens a block', 'color: red;', rewriteColor('x{'), []],
      ['a declaration rewrite that opens a string', 'color: red;', rewriteColor('"x'), []],
      [
        'a declaration rewrite that writes a comment',
        'color: red; top: 0;',
        rewriteColor('red /* note */'),
        ['.a{top:0;}'],
      ],
      [
        'a declaration rewrite in an at-rule, keeping its siblings',
        '@media print { color: red; &:hover { top: 0; } }',
        rewriteColor('x}html{display:none}a{b:y'),
        ['@media print{.a:hover{top:0;}}'],
      ],
      [
        'a declaration rewrite in keyframes',
        '@keyframes k { from { color: red; } }',
        rewriteColor('x}}html{display:none}@keyframes j{from{b:y'),
        ['@keyframes k{from{}}'],
      ],
      [
        'a declaration rewrite in a declaration-only at-rule',
        '@font-face { color: red; }',
        rewriteColor('x}html{display:none}a{b:y'),
        [],
      ],
      [
        'a declaration rewrite into several, one of which closes the block',
        'color: red; top: 0;',
        {
          decl: (prop, authored) =>
            prop === 'color'
              ? [
                  { prop: 'a', value: 'b' },
                  { prop: 'x', value: '}' },
                ]
              : { prop, value: authored },
        },
        ['.a{top:0;}'],
      ],
      ['a selector rewrite', 'color: red;', { rw: selector => selector + '{}html' }, []],
      [
        'one selector of a rewrite that returns several',
        'color: red;',
        { rw: selector => [selector, selector + '{}html'] },
        ['.a{color:red;}'],
      ],
    ])('drops what %s leaves', (_label, css, options, expected) => {
      resetWarnOnce();
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      expect(emitWeb(parse(normalize(css)), '.a', options)).toEqual(expected);
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it.each<[string, string, string[]]>([
      [
        'an unquoted url holding a statement end and quotes',
        'background: url(data:image/svg+xml;utf8,<svg a="b"/>);',
        ['.a{background:url(data:image/svg+xml;utf8,<svg a="b"/>);}'],
      ],
      ['a brace in a string', 'content: "}";', ['.a{content:"}";}']],
      ['an escaped brace in a selector', '.b\\{c { top: 0; }', ['.a .b\\{c{top:0;}']],
      ['a brace in an attribute selector', '[data-x="{"] { top: 0; }', ['.a [data-x="{"]{top:0;}']],
      [
        'a nested at-rule',
        '@media print { @media screen { top: 0; } }',
        ['@media print{@media screen{.a{top:0;}}}'],
      ],
    ])('keeps %s', (_label, css, expected) => {
      expect(emit(css)).toEqual(expected);
    });

    it('keeps every rule of a large stylesheet under a selector list', () => {
      const wrapper = `.${'w'.repeat(42)},.${'x'.repeat(42)}`;
      const rule = (i: number) => `.${'r'.repeat(56)}${i}{top:0;}`;
      const rules = Array.from({ length: 1000 }, (_, i) => rule(i)).join('');

      expect(emitWeb(parse(`${wrapper}{${rules}}`), '')).toHaveLength(1000);
    });

    // A rule per sibling, each under its parent's whole list. Once the parent's text passes the
    // size limit every later sibling drops, so their cost must not grow with the parent.
    it('bounds what one emit composes across sibling rules', () => {
      const list = `.${'a'.repeat(20)},.${'b'.repeat(20)}{`;
      const css = `color:red;${list.repeat(12)}${'.x{top:0;}'.repeat(400)}${'}'.repeat(12)}`;
      const ast = parse(css);
      resetWarnOnce();
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const start = performance.now();
      const rules = emitWeb(ast, '.a');
      const elapsedMs = performance.now() - start;

      expect(rules[0]).toBe('.a{color:red;}');
      expect(rules.join('').length).toBeLessThan(1 << 24);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(elapsedMs).toBeLessThan(500);
    });

    // An at-rule's children take its parent's selector whole, with nothing composed, so each one
    // writes the parent's text again. That text counts, and past the limit a sibling costs nothing.
    const composedList = 'a,a,a,a{'.repeat(8);
    const composedHead = Array.from({ length: 4 ** 8 }, () => `.a${' a'.repeat(8)}`).join(',');
    const longHead = `.a ${'x'.repeat(60000)}`;

    it.each<[string, string, string]>([
      [
        'at-rule siblings under a selector list',
        `${composedList}${'@media x{top:0;}'.repeat(2000)}${'}'.repeat(8)}`,
        `@media x{${composedHead}{top:0;}}`,
      ],
      [
        'nested at-rule siblings under a selector list',
        `${composedList}${'@media x{@media y{top:0;}}'.repeat(2000)}${'}'.repeat(8)}`,
        `@media x{@media y{${composedHead}{top:0;}}}`,
      ],
      [
        'at-rule siblings under a long selector',
        `${'x'.repeat(60000)}{${'@media x{top:0;}'.repeat(20000)}}`,
        `@media x{${longHead}{top:0;}}`,
      ],
      [
        'empty selector lists under a long selector',
        `${'x'.repeat(60000)}{${',{top:0;}'.repeat(20000)}}`,
        `${longHead}{top:0;}`,
      ],
    ])('bounds what one emit writes for %s', (_label, css, expectedRule) => {
      const ast = parse(css);
      resetWarnOnce();
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const start = performance.now();
      const rules = emitWeb(ast, '.a');
      const elapsedMs = performance.now() - start;

      expect(rules.length).toBeGreaterThan(0);
      expect(rules.every(rule => rule === expectedRule)).toBe(true);
      expect(rules.reduce((size, rule) => size + rule.length, 0)).toBeLessThan(1 << 24);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(elapsedMs).toBeLessThan(500);
    });

    // Text a namespace or a plugin adds to a head reaches the output as well as what was composed.
    it.each<[string, string, EmitOptions]>([
      [
        'a namespace',
        `${'a,'.repeat(30000)}a{${'.y{top:0;}'.repeat(2000)}}`,
        { namespace: `.${'n'.repeat(100)}` },
      ],
      [
        'a plugin that returns several selectors',
        `${'x'.repeat(60000)}{${'.y{top:0;}'.repeat(2000)}}`,
        { rw: selector => Array.from({ length: 10 }, () => selector) },
      ],
      [
        'a plugin that lengthens a selector',
        `${'x'.repeat(60000)}{${'.y{top:0;}'.repeat(2000)}}`,
        { rw: selector => selector + ' '.repeat(600000) + '.z' },
      ],
    ])('counts the head text %s writes', (_label, css, options) => {
      const ast = parse(css);
      resetWarnOnce();
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const start = performance.now();
      const rules = emitWeb(ast, '.a', options);
      const elapsedMs = performance.now() - start;

      expect(rules.length).toBeGreaterThan(0);
      expect(rules.reduce((size, rule) => size + rule.length, 0)).toBeLessThan(1 << 24);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(elapsedMs).toBeLessThan(1_000);
    });

    it('reads a deep at-rule without reading its children at every level', () => {
      const depth = 500;
      const css = '@media a{'.repeat(depth) + '.x{a:b;}'.repeat(60000) + '}'.repeat(depth);
      const ast = parse(css);

      const start = performance.now();
      emitWeb(ast, '.a');
      expect(performance.now() - start).toBeLessThan(1_000);
    });
  });

  /**
   * Server components place a `<style data-styled>` tag between siblings, so `+` would miss an
   * element whose neighbor sits behind one or two tags.
   * https://drafts.csswg.org/selectors-4/#adjacent-sibling-combinators
   * "The adjacent sibling combinator is a combinator that separates two compound selectors
   * [...] The elements represented by the two compound selectors share the same parent in the
   * document tree and the element represented by the first compound selector immediately
   * precedes the element represented by the second one."
   * https://drafts.csswg.org/selectors-4/#specificity-rules
   * "The specificity of an :is(), :not(), or :has() pseudo-class is replaced by the specificity
   * of the most specific complex selector in its selector list argument."
   * "The specificity of a :where() pseudo-class is replaced by zero."
   */
  describe('adjacent-sibling combinator under server components', () => {
    const TAG = ':where(style[data-styled])';
    const bridge = (compound: string) =>
      `:is(${compound},${compound}+${TAG},${compound}+${TAG}+${TAG})`;

    const emitRsc = loadRscEmitWeb();
    const emitRscCss = (css: string) => emitRsc(parse(normalize(css)), '.a');

    it.each<[string, string, string]>([
      ['a self adjacency', '& + & { top: 0; }', `${bridge('.a')}+.a{top:0;}`],
      ['a parent combinator before it', '.x > & + .b { top: 0; }', `.x>${bridge('.a')}+.b{top:0;}`],
      [
        'a descendant combinator before it',
        '.x & + .b { top: 0; }',
        `.x ${bridge('.a')}+.b{top:0;}`,
      ],
      ['a chain', '& + .c + .d { top: 0; }', `${bridge('.a')}+${bridge('.c')}+.d{top:0;}`],
      [
        'a selector list',
        '& + .c, .d > .e + & { top: 0; }',
        `${bridge('.a')}+.c,.d>${bridge('.e')}+.a{top:0;}`,
      ],
      [
        'a pseudo-class and an attribute on the compound',
        '&:hover[data-x] + .c { top: 0; }',
        `${bridge('.a:hover[data-x]')}+.c{top:0;}`,
      ],
      [
        'an at-rule around it',
        '@media print { & + & { top: 0; } }',
        `@media print{${bridge('.a')}+.a{top:0;}}`,
      ],
      [
        'a selector function with a list on the compound',
        '&:is(.p, .q) + .c { top: 0; }',
        `${bridge('.a:is(.p, .q)')}+.c{top:0;}`,
      ],
    ])('rewrites %s', (_label, css, expected) => {
      expect(emitRscCss(css)).toEqual([expected]);
    });

    it.each<[string, string]>([
      ['inside :is()', '&:is(.b+.c) { top: 0; }'],
      ['inside :not()', '&:not(.b+.c) { top: 0; }'],
      ['inside :has()', '&:has(+ .c) { top: 0; }'],
      ['inside :nth-child()', '&:nth-child(2n+1) { top: 0; }'],
      ['in an attribute value', '&[data-x="a+b"] { top: 0; }'],
      ['in a string-valued attribute with an escaped quote', '&[data-x="a\\"+b"] { top: 0; }'],
      ['escaped', '&.c\\+d { top: 0; }'],
      ['absent, with a general sibling combinator', '& ~ .c { top: 0; }'],
      ['absent, with a descendant combinator', '& .c { top: 0; }'],
      ['absent, with a child combinator', '& > .c { top: 0; }'],
    ])('leaves a plus %s alone', (_label, css) => {
      const rsc = emitRscCss(css);

      expect(rsc).toEqual(emit(css));
      expect(rsc).toHaveLength(1);
    });

    it('keeps the text of a selector with no plus', () => {
      expect(emitRscCss('& > .c, .d .e { top: 0; }')).toEqual(['.a>.c,.a .d .e{top:0;}']);
    });

    it('does not rewrite outside server components', () => {
      expect(emit('.x > & + .b { top: 0; }')).toEqual(['.x>.a+.b{top:0;}']);
    });

    it('rewrites the heads a plugin returns', () => {
      expect(
        emitRsc(parse(normalize('top: 0;')), '.a', { rw: selector => [selector + '+.c', '.d'] })
      ).toEqual([`${bridge('.a')}+.c{top:0;}`, '.d{top:0;}']);
    });

    // A plugin or namespace can leave whitespace around the combinator; it belongs to the
    // combinator, so the compound ends at the last character before it.
    it.each<[string, string, string]>([
      ['spaces around it', '.a + .c', `${bridge('.a')} + .c`],
      ['a tab and a newline around it', '.a\t+\n.c', `${bridge('.a')}\t+\n.c`],
      ['a descendant combinator before it', '.x  .a + .c', `.x  ${bridge('.a')} + .c`],
      ['an escaped space ending the compound', '.a\\ +.c', `${bridge('.a\\ ')}+.c`],
      ['a plus leading the head', '+ .c', '+ .c'],
      ['a plus after a child combinator', '.a > + .c', '.a > + .c'],
    ])('rewrites a plugin head with %s', (_label, head, expectedHead) => {
      expect(emitRsc(parse(normalize('top: 0;')), '.a', { rw: () => head })).toEqual([
        `${expectedHead}{top:0;}`,
      ]);
    });

    // A head that stays unread after the rewrite must still be dropped by `wholeRule`, so the
    // inserted text must not close what the head left open.
    it.each<[string, string]>([
      ['a paren', '.b+.c('],
      ['a bracket', '.b+.c['],
      ['a string', '.b+".c'],
      ['a paren inside a bracket', '.b+[x(].c'],
    ])('drops a head that leaves %s open after a plus', (_label, head) => {
      resetWarnOnce();
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      expect(emitRsc(parse(normalize('top: 0;')), '.a', { rw: () => head })).toEqual([]);
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('scans a long selector with many plus signs in linear time', () => {
      const count = 20000;
      const css = `${'x+'.repeat(count)}b{top:0;}`;
      const ast = parse(css);

      const start = performance.now();
      const rules = emitRsc(ast, '.a');
      const elapsedMs = performance.now() - start;

      expect(rules).toEqual([`.a ${`${bridge('x')}+`.repeat(count)}b{top:0;}`]);
      expect(elapsedMs).toBeLessThan(500);
    });

    // The wrapped text is several times the authored head, so it counts toward what one emit
    // composes, or a sibling rule under a long selector would write it without limit.
    it('counts the text the rewrite adds toward what one emit composes', () => {
      const css = `${'x+'.repeat(3000)}b{${'.y{top:0;}'.repeat(100)}}`;
      const ast = parse(css);
      resetWarnOnce();
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const start = performance.now();
      const rules = emitRsc(ast, '.a');
      const elapsedMs = performance.now() - start;

      expect(rules.length).toBeGreaterThan(0);
      expect(rules.reduce((size, rule) => size + rule.length, 0)).toBeLessThan(1 << 24);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(elapsedMs).toBeLessThan(1_000);
    });
  });
});
