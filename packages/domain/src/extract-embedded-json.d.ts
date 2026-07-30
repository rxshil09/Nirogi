/**
 * Extracts a JSON object embedded in HTML via a variable assignment marker.
 *
 * Uses a **balanced-brace parser** (tracking `{`/`}` depth, with proper handling
 * of `"` string boundaries and `\` escape sequences) to find the JSON object's
 * true end. This is structurally safe and avoids the fragile adjacent-marker
 * approach (`indexOf("window.__", start)`) which breaks if any string value
 * inside the JSON contains a substring resembling the next marker.
 *
 * @param html   - Full HTML string from the server-rendered page.
 * @param marker - Assignment marker, e.g. `"window.__INITIAL_STATE__ ="` or
 *                 `"window.__INITIAL_STATE__="`. The function finds the first
 *                 occurrence of the marker and starts parsing from the character
 *                 immediately after it.
 * @returns      Parsed JSON value (typically an object).
 * @throws       If the marker is not found, the JSON is malformed, or braces
 *               are unbalanced.
 */
export declare function extractEmbeddedJSON(html: string, marker: string): unknown;
