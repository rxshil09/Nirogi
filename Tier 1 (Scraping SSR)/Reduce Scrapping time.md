# Reduce Scrapping time

## 1mg

This is almost ideal.

```
GET HTML
      ↓
window.__INITIAL_STATE__
      ↓
JSON.parse()
      ↓
Extract price
```

No DOM.

No Playwright.

No waiting.

Just one HTTP request.

If this works consistently, your 1mg adapter becomes something like:

```
fetch(url)↓extractInitialState(html)↓mapToMedicine()
```

This should take well under a second.

```jsx
(async () => {
    const html = await fetch("https://www.1mg.com/drugs/azel-80-capsule-682932")
        .then(r => r.text());

    const start =
        html.indexOf("__INITIAL_STATE__ =") +
        "__INITIAL_STATE__ =".length;

    const end = html.indexOf("window.__", start);

    const json = html
        .slice(start, end)
        .trim()
        .replace(/;$/, "");

    const state = JSON.parse(json);

    console.log(state.drugPageReducer.dynamicData.priceBox);
})();

```

## PharmEasy

```jsx
const url =
  "https://pharmeasy.in/online-medicine-order/dolo-650mg-strip-of-15-tablets-44140";

(async () => {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0.0.0 Safari/537.36",
      },
    });

    const html = await res.text();

    const match = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
    );

    if (!match) {
      throw new Error("__NEXT_DATA__ not found");
    }

    const data = JSON.parse(match[1]);

    const product = data.props.pageProps.productDetails;

    console.log(product);
  } catch (err) {
    console.error(err);
  }
})();
```

## NetMeds

```jsx
(async () => {
    const html = await fetch(location.href).then(r => r.text());

    const marker = "window.__INITIAL_STATE__=";
    const start = html.indexOf(marker);

    if (start === -1) {
        console.log("INITIAL_STATE not found");
        return;
    }

    let i = start + marker.length;
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

        if (ch === "\\") {
            escaped = true;
            continue;
        }

        if (ch === '"') {
            inString = !inString;
            continue;
        }

        if (inString) continue;

        if (ch === "{") depth++;

        if (ch === "}") {
            depth--;

            if (depth === 0) {
                end = i + 1;
                break;
            }
        }
    }

    const json = html.slice(start + marker.length, end);

    const state = JSON.parse(json);

    console.log("JSON parsed successfully!");

    function findProducts(node, path = "root") {

        if (Array.isArray(node)) {

            if (
                node.length &&
                typeof node[0] === "object" &&
                node[0] !== null &&
                "slug" in node[0] &&
                "name" in node[0]
            ) {

                console.log("FOUND PRODUCT ARRAY");
                console.log("Path:", path);
                console.log("Count:", node.length);
                console.log("First Product:", node[0]);

                return true;
            }

            for (let i = 0; i < node.length; i++) {
                if (findProducts(node[i], `${path}[${i}]`))
                    return true;
            }

        } else if (node && typeof node === "object") {

            for (const key of Object.keys(node)) {

                if (findProducts(node[key], `${path}.${key}`))
                    return true;

            }

        }

        return false;
    }

    findProducts(state);
})();
```