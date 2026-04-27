# 04. ESLint setup

Audience: AI agents reproducing this setup. Prerequisites: `01-cleanup.md`, `02-disable-web.md`, and `03-prettier.md` applied.

## Context

- Goal: enable ESLint (flat config, ESLint 9) on top of the Expo default lint preset, and make it coexist with the Prettier setup from step 03 without rule conflicts.
- Integration stance: Prettier runs **independently** through `npm run format` / `format:check`. ESLint only needs `eslint-config-prettier` to turn off stylistic rules that would otherwise fight Prettier. We deliberately skip `eslint-plugin-prettier` (which Expo's own guide uses in its example) — see the divergence note at the end.

## Step 1 — Install packages

Use `expo install` so the Expo-versioned package lands at the SDK-compatible version. Non-SDK packages fall through to `npm install`.

```sh
npx expo install eslint eslint-config-expo eslint-config-prettier -- --save-dev
```

**Known gotcha:** `expo install` treats `eslint-config-expo` as an SDK-versioned package and writes it into `dependencies`, not `devDependencies`, even with the `--save-dev` pass-through flag. Move it manually:

1. In `package.json`, cut `"eslint-config-expo": "~55.0.0"` from `dependencies`.
2. Paste it into `devDependencies`, keeping alphabetical order (between `eslint` and `eslint-config-prettier`).
3. Run `npm install` to resync the lockfile.

Resulting `devDependencies` block:

```json
"devDependencies": {
  "@types/react": "~19.2.2",
  "eslint": "^9.39.4",
  "eslint-config-expo": "~55.0.0",
  "eslint-config-prettier": "^10.1.8",
  "prettier": "3.8.3",
  "typescript": "~5.9.2"
}
```

> Versions reflect what was pinned at SDK 55 time of writing. On reproduction, accept whatever `expo install` selects for `eslint-config-expo`; accept latest for the other two.

## Step 2 — Create `eslint.config.js`

File path: `./eslint.config.js` (CommonJS — matches Expo's documented example; `expo lint` loads it unchanged).

```js
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintConfigPrettier = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  expoConfig,
  eslintConfigPrettier,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*'],
  },
]);
```

Key points:

- **Order matters.** `eslintConfigPrettier` must come **after** `expoConfig` so its rule-disabling entries override any stylistic rules inherited from the Expo preset.
- Use `eslint-config-prettier/flat` (not the legacy default export) to get a proper flat-config object.
- `ignores` is in its own config object per flat-config convention. `node_modules` is already ignored by ESLint's default, but listing it explicitly makes the config self-documenting.
- No `parser` / `plugins` / `languageOptions` block is needed — everything required for `.ts`/`.tsx` comes from `eslint-config-expo/flat`.

## Step 3 — Add `lint:fix` script

The template already provides `"lint": "expo lint"`. Add a fix variant below it:

```json
{
  "scripts": {
    "lint": "expo lint",
    "lint:fix": "expo lint -- --fix"
  }
}
```

The `--` pass-through is required: `expo lint` otherwise swallows the `--fix` flag.

Full scripts block at the end of this step:

```json
"scripts": {
  "start": "expo start",
  "android": "expo start --android",
  "ios": "expo start --ios",
  "lint": "expo lint",
  "lint:fix": "expo lint -- --fix",
  "format": "prettier --write .",
  "format:check": "prettier --check ."
}
```

## Step 4 — Verify

```sh
npm run lint
npm run format:check
```

Expected:

- `npm run lint` exits `0` with no output. (The Expo preset recognizes the minimal `src/app/*.tsx` files as clean.)
- `npm run format:check` ends with `All matched files use Prettier code style!`.

If `npm run lint` complains about stylistic rules (quote style, semicolons, trailing commas, etc.), something is wrong with the config order — double-check that `eslintConfigPrettier` comes after `expoConfig`.

## Divergence from Expo's official guide

Expo's guide (`https://docs.expo.dev/guides/using-eslint/`) shows:

```js
// Expo-official example (NOT used here)
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');
module.exports = defineConfig([expoConfig, eslintPluginPrettierRecommended, ...]);
```

We **do not** use `eslint-plugin-prettier` because:

1. Prettier's own maintainers discourage running Prettier inside ESLint — it's slower and conflates two roles (lint = logic correctness, format = cosmetic).
2. We already enforce Prettier as a first-class CI gate via `npm run format:check`, so there's no coverage gap.
3. Keeping lint fast matters for the smoke script in step 06.

If a future step (e.g., IDE integration without a Prettier plugin) genuinely requires inline formatting-as-lint-errors, re-evaluate then and add `eslint-plugin-prettier` alongside, not in place of, `eslint-config-prettier`.

## Notes for future steps

- **Unistyles (step 05):** Unistyles' babel plugin can rewrite component code; if that produces files ESLint flags, add the generated path to `ignores` in `eslint.config.js` rather than disabling rules.
- **Smoke script (step 06):** the smoke target should compose `tsc --noEmit && expo lint && prettier --check .`. Keep `lint` and `format:check` as separate steps in that script so a failure's source is obvious.
- **Adding rules:** append more objects to the `defineConfig` array after `eslintConfigPrettier`. Anything placed after the Prettier config wins, so put the Prettier-disable last, then your custom rule overrides last-of-all if needed.
- **`.eslintignore` is NOT used.** Flat config's `ignores` field replaces it; creating `.eslintignore` has no effect on ESLint 9's flat config loader.
