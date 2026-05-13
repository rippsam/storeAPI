# Claude Instructions

## Commits
- Never add `Co-Authored-By: Claude` or any AI attribution to commit messages.

## Check existing code first
Before writing any new script, function, or fix — read the relevant existing files first. Check `scripts/` before writing a migration or data script; the solution often already exists.

## Database
- `store.db` is committed to the repo and is the live database — there is no separate staging DB. Scripts that modify it (e.g. `assign-local-images.js`) should be run deliberately.
- `src/index.js` opens the DB with `{ readonly: true }`. Scripts that write to it must open their own writable connection.

## Images
- Product images live in `Memes/`, served at the `/images` route. Keep them here — do not move them to the website repo.
- Files in `Memes/` have `.png` extensions but many are actually JPEG/WebP/GIF. This is fine — browsers sniff content type from the file header, not the extension.
- `scripts/assign-local-images.js` randomly reassigns all product images. Only run it intentionally.
- `scripts/add-product-images-table.js` is destructive: it drops and repopulates all rows in `product_images` and resyncs `products.product_image` to match `sort_order=0`. Only run it intentionally.
- `scripts/import.js` — imports `Store-1.sql` into a fresh `store.db`. Deletes the existing DB first. Only run when rebuilding from scratch.
- `scripts/update-images.js` — replaces LoremFlickr fallback URLs with real product images via Bing Image Search API. Requires `.image-api-keys` env file. Only processes products still using LoremFlickr.
- `scripts/update-descriptions.js` — populates `product_description` via Groq API (Llama 3.1 8B). Requires `GROQ_API_KEY`. Resumable — tracks progress in `scripts/.desc-progress.json`.

## API route ordering
In `src/index.js`, `GET /products/search` must be declared before `GET /products/:id`. Express matches routes in order — if `:id` comes first, the literal string "search" is captured as a product ID and returns a 404.

## Hosting
The API runs on Render's free tier at `https://storeapi-60py.onrender.com`. It spins down after 15 minutes of inactivity — the first request after idle takes 15–30 seconds to respond. This is expected behavior.

## product_images table
- Schema: `(id, product_id, image_url, sort_order)`. Each product has 1–3 images.
- `sort_order=0` is the primary image; it is synced back to `products.product_image` so card views and the detail gallery always show the same first image.
- The website fetches all images via `GET /products/:id/images`, which reads from this table ordered by `sort_order`.

## JavaScript style
- Use `const` by default; use `let` when the variable is reassigned. Never use `var`.
- Do not use arrow functions. Use `function` declarations for named functions and `function()` expressions for callbacks.
- Use `forEach` and other array methods (`map`, `filter`, `find`, `findIndex`, `reduce`, `some`, `every`, `flat`, `flatMap`) instead of standard `for` loops. Only use `do…while` when retry/uniqueness logic genuinely requires it.
- Use template literals instead of string concatenation.
- Use optional chaining `?.` and nullish coalescing `??` where appropriate.
- Use shorthand method syntax in objects: `{ method() {} }` not `{ method: function() {} }`.
