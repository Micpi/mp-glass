import { readFileSync } from 'node:fs';
import { parse } from 'acorn';
import { describe, expect, it } from 'vitest';

describe('built bootstrap', () => {
  it('stays readable by old tablets (ES2017, plus import() and import.meta)', () => {
    const code = readFileSync(new URL('../custom_components/mp_glass/www/mp-glass-bootstrap.js', import.meta.url), 'utf8');
    // Supported by iOS 12 and old Android WebViews, though standardised in ES2020.
    const es2017 = code.replace(/\bimport\(/g, '__import(').replace(/\bimport\.meta\b/g, '__meta');
    expect(() => parse(es2017, { ecmaVersion: 2017, sourceType: 'module' })).not.toThrow();
    expect(code).toContain('customElements.define(');
  });
});
