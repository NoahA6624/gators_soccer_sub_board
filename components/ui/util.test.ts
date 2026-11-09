import { describe, expect, it } from 'vitest';
import { relabel, safeHtml } from './util';
import type { NameIndex } from '@/lib/engine';

const idx = { Jane: { last: 'Jane', first: 'Mary', num: '19' } } as unknown as NameIndex;

describe('safeHtml / relabel', () => {
  it('keeps <b> and <br>, escapes everything else', () => {
    expect(safeHtml('a <b>x</b><br/> <img src=x onerror=alert(1)>')).toBe('a <b>x</b><br> &lt;img src=x onerror=alert(1)&gt;');
    expect(safeHtml('<b onclick="x">y</b>')).toBe('&lt;b onclick=&quot;x&quot;&gt;y</b>');
  });
  it('does not double-escape engine entities', () => expect(safeHtml('Tom &amp; Co &lt;3')).toBe('Tom &amp; Co &lt;3'));
  it('relabels known names and leaves unknown (escaped) text', () => {
    expect(relabel('First off: <b>Jane</b> 20\'', idx)).toBe('First off: <b>#19 - Mary Jane</b> 20&#39;');
    expect(relabel('vs <b><script>alert(1)</script></b>', idx)).not.toContain('<script>');
  });
});
