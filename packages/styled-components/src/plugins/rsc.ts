import type { SCPlugin } from '../utils/compiler';
import { rewriteSelectorForRSC } from './rscSelectorRewrite';

/**
 * RSC plugin: rewrites `:first-child`, `:last-child`, `:only-child`, `:nth-child()`
 * and `:nth-last-child()` so inline `<style data-styled>` tags don't break
 * child-index selectors. Requires CSS Selectors Level 4 `of S` syntax. The `+`
 * combinator needs no plugin: server component output already matches across
 * style tags.
 *
 * ```jsx
 * // app/layout.tsx: every server component
 * import { configureServerStyles } from 'styled-components';
 * import { rscPlugin } from 'styled-components/plugins';
 *
 * configureServerStyles({ plugins: [rscPlugin] });
 *
 * // or only the server components rendered inside one manager
 * <StyleSheetManager plugins={[rscPlugin]}>...</StyleSheetManager>
 * ```
 */
const rscPlugin: SCPlugin = {
  name: 'rsc',
  rw: rewriteSelectorForRSC,
};

export default rscPlugin;
