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
export function extractEmbeddedJSON(html: string, marker: string): unknown {
  const markerIdx = html.indexOf(marker);
  if (markerIdx === -1) {
    throw new Error(`Marker "${marker}" not found in HTML`);
  }

  // Start scanning after the marker
  let i = markerIdx + marker.length;

  // Skip optional whitespace before the opening brace
  while (i < html.length && (html[i] === ' ' || html[i] === '\t' || html[i] === '\n' || html[i] === '\r')) {
    i++;
  }

  if (html[i] !== '{') {
    throw new Error(`Expected '{' after marker "${marker}", found "${html[i]}" at position ${i}`);
  }

  // Balanced-brace parser
  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;

  for (; i < html.length; i++) {
    const ch = html[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  if (end === -1) {
    throw new Error(`Unbalanced braces after marker "${marker}" — could not find end of JSON object`);
  }

  const jsonSlice = html.slice(markerIdx + marker.length, end).trim().replace(/;$/, '');

  return JSON.parse(jsonSlice);
}
