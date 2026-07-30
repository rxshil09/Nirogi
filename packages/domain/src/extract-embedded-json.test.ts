import { describe, it, expect } from 'vitest';
import { extractEmbeddedJSON } from './extract-embedded-json.js';

describe('extractEmbeddedJSON', () => {
  it('normal case - simple JSON object after marker', () => {
    const html = `<html><script>window.__INITIAL_STATE__ = {"price": 123, "mrp": 150};</script></html>`;
    const result = extractEmbeddedJSON(html, 'window.__INITIAL_STATE__ =') as Record<string, number>;
    expect(result.price).toBe(123);
    expect(result.mrp).toBe(150);
  });

  it('handles escaped quotes inside string values', () => {
    // JSON: {"name": "Dr. Reddy\"s Labs", "price": 99}
    // The \" inside the JSON string value is a valid JSON escape for a literal double-quote.
    // JSON.parse correctly decodes it to: Dr. Reddy"s Labs
    const jsonStr = '{"name": "Dr. Reddy\\"s Labs", "price": 99}';
    const html = `<html><script>window.__INITIAL_STATE__ = ${jsonStr};</script></html>`;
    const result = extractEmbeddedJSON(html, 'window.__INITIAL_STATE__ =') as Record<string, unknown>;
    expect(result.name).toBe('Dr. Reddy"s Labs'); // \" in JSON decodes to "
    expect(result.price).toBe(99);
  });

  it('handles nested braces inside string values', () => {
    const html = `<html><script>window.__INITIAL_STATE__ = {"meta": "{nested: true}", "price": 50};</script></html>`;
    const result = extractEmbeddedJSON(html, 'window.__INITIAL_STATE__ =') as Record<string, unknown>;
    expect(result.meta).toBe('{nested: true}');
    expect(result.price).toBe(50);
  });

  it('handles deeply nested objects', () => {
    const html = `<html><script>window.__INITIAL_STATE__ = {"drugPageReducer": {"dynamicData": {"priceBox": {"price": 124, "mrp": 134}}}};</script></html>`;
    const result = extractEmbeddedJSON(html, 'window.__INITIAL_STATE__ =') as Record<string, unknown>;
    const reducer = result.drugPageReducer as Record<string, unknown>;
    const dynamic = reducer.dynamicData as Record<string, unknown>;
    const priceBox = dynamic.priceBox as Record<string, number>;
    expect(priceBox.price).toBe(124);
    expect(priceBox.mrp).toBe(134);
  });

  it('works without space before equals (Netmeds style marker)', () => {
    const html = `<html><script>window.__INITIAL_STATE__={"query": "dolo"};</script></html>`;
    const result = extractEmbeddedJSON(html, 'window.__INITIAL_STATE__=') as Record<string, unknown>;
    expect(result.query).toBe('dolo');
  });

  it('throws when marker not found', () => {
    const html = `<html><script>window.OTHER_STATE = {"x": 1};</script></html>`;
    expect(() => extractEmbeddedJSON(html, 'window.__INITIAL_STATE__ =')).toThrow('not found');
  });

  it('throws when braces are unbalanced', () => {
    const html = `<html><script>window.__INITIAL_STATE__ = {"price": 100</script></html>`;
    expect(() => extractEmbeddedJSON(html, 'window.__INITIAL_STATE__ =')).toThrow();
  });
});
