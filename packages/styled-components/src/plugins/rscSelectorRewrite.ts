import { SC_ATTR } from '../constants';
import { splitTopLevelCommas } from '../parser/parser';

// RSC selector rewrite: child-index pseudos use Selectors L4 `of S` syntax so
// inline `<style data-styled>` tags appearing as real DOM children are not counted.

const CHILD_RE =
  /:(?:(first)-child|(last)-child|(only)-child|(nth-child)\(([^()]+)\)|(nth-last-child)\(([^()]+)\))/g;

const EXCLUDE = `:not(style[${SC_ATTR}])`;

function rewriteChildPseudos(selector: string): string {
  if (selector.indexOf('-child') === -1) return selector;
  return selector.replace(
    CHILD_RE,
    (_match, first, last, only, nth, nthArgs, _nthLast, nthLastArgs) => {
      if (first) return `:nth-child(1 of ${EXCLUDE})`;
      if (last) return `:nth-last-child(1 of ${EXCLUDE})`;
      if (only) return `:nth-child(1 of ${EXCLUDE}):nth-last-child(1 of ${EXCLUDE})`;
      if (nth) {
        if (nthArgs.indexOf(' of ') !== -1) return _match;
        return `:nth-child(${nthArgs} of ${EXCLUDE})`;
      }
      if (nthLastArgs.indexOf(' of ') !== -1) return _match;
      return `:nth-last-child(${nthLastArgs} of ${EXCLUDE})`;
    }
  );
}

/**
 * Apply the child-pseudo rewrite to every comma-separated part of a resolved
 * selector. Returns a single comma-joined string suitable for CSS output.
 */
export function rewriteSelectorForRSC(selector: string): string {
  if (selector.indexOf('-child') === -1) return selector;

  const parts = splitTopLevelCommas(selector);
  for (let i = 0; i < parts.length; i++) parts[i] = rewriteChildPseudos(parts[i]);

  return parts.join(',');
}
