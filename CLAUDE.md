# Claude Instructions

## Commits
- Never add `Co-Authored-By: Claude` or any AI attribution to commit messages.

## Database
- `store.db` is committed to the repo and is the live database — there is no separate staging DB. Scripts that modify it (e.g. `assign-local-images.js`) should be run deliberately.
- `src/index.js` opens the DB with `{ readonly: true }`. Scripts that write to it must open their own writable connection.

## Images
- Product images live in `Memes/`, served at the `/images` route. Keep them here — do not move them to the website repo.
- `scripts/assign-local-images.js` randomly reassigns all product images. Only run it intentionally.

## JavaScript style
- Use `const` by default; use `let` when the variable is reassigned. Never use `var`.
- Do not use arrow functions. Use `function` declarations for named functions and `function()` expressions for callbacks.
- Use `forEach` and other array methods (`map`, `filter`, `find`, `findIndex`, `reduce`, `some`, `every`, `flat`, `flatMap`) instead of standard `for` loops. Only use `do…while` when retry/uniqueness logic genuinely requires it.
- Use template literals instead of string concatenation.
- Use optional chaining `?.` and nullish coalescing `??` where appropriate.
- Use shorthand method syntax in objects: `{ method() {} }` not `{ method: function() {} }`.
