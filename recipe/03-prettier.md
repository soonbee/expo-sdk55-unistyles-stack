# 03. Prettier setup

Audience: AI agents reproducing this setup. Prerequisites: `01-cleanup.md` and `02-disable-web.md` applied.

## Context

- Goal: add Prettier with rules that match common Expo / React Native community conventions, so later steps (ESLint integration, Unistyles migration, etc.) can lean on a consistent formatter.
- No community-shared preset is used — the rules are inlined in `.prettierrc`. Prettier's own philosophy is minimal configuration, so only widely-adopted overrides are specified.

## Step 1 — Install Prettier

Pin the exact version so every reproduction produces byte-identical output.

```sh
npm install --save-dev --save-exact prettier
```

Result: `prettier` lands in `devDependencies` (at the time of writing: `3.8.3`).

## Step 2 — Create `.prettierrc`

File path: `./.prettierrc`

```json
{
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": true,
  "jsxSingleQuote": false,
  "trailingComma": "all",
  "bracketSpacing": true,
  "bracketSameLine": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

Rationale for each override away from Prettier's defaults:

| Option            | Value      | Why                                                                    |
| ----------------- | ---------- | ---------------------------------------------------------------------- |
| `printWidth`      | `100`      | RN/Expo source (expo-router, react-navigation) uses 100                |
| `singleQuote`     | `true`     | Matches the style already in `src/app/*.tsx`                           |
| `jsxSingleQuote`  | `false`    | JSX attributes stay as double quotes — React/RN convention             |
| `trailingComma`   | `"all"`    | Cleaner diffs; safe on every JS/TS target this project uses            |
| `bracketSameLine` | `false`    | Keep the closing `>` of multiline JSX on its own line (default RN)     |
| `arrowParens`     | `"always"` | Consistent `(x) => …` form; avoids churn when adding a 2nd param       |
| `endOfLine`       | `"lf"`     | Enforce Unix line endings so Windows checkouts don't reformat the repo |

`tabWidth`, `useTabs`, `semi`, `bracketSpacing` are left at Prettier defaults but declared explicitly so the config reads as a complete spec.

## Step 3 — Create `.prettierignore`

File path: `./.prettierignore`

```
node_modules
.expo
dist
build
ios
android
coverage
package-lock.json
yarn.lock
pnpm-lock.yaml
assets
```

Notes:

- `ios/` and `android/` are only present after `expo prebuild`, but ignoring them up-front prevents future surprises.
- `assets/` is ignored because it contains binary files (images, `expo.icon/Assets/*.svg`) Prettier shouldn't touch.
- Lockfiles are ignored so the package manager owns their formatting.

## Step 4 — Add npm scripts

Append two scripts to `package.json`'s `"scripts"` block:

```json
{
  "scripts": {
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

Leave existing scripts (`start`, `android`, `ios`, `lint`) untouched. The resulting script order:

```json
"scripts": {
  "start": "expo start",
  "android": "expo start --android",
  "ios": "expo start --ios",
  "lint": "expo lint",
  "format": "prettier --write .",
  "format:check": "prettier --check ."
}
```

## Step 5 — Apply and verify

```sh
npm run format
npm run format:check
```

Expected:

- `npm run format` rewrites any not-yet-formatted files (on a fresh reproduction this typically includes `01-cleanup.md`, `02-disable-web.md`, and `tsconfig.json`; the minimal `src/app/*.tsx` files are already compliant).
- `npm run format:check` ends with `All matched files use Prettier code style!`.

## Notes for future steps

- **ESLint integration (step 04):** add `eslint-config-prettier` as the last entry in the ESLint config's `extends`/flat-config array so stylistic rules don't collide. Do **not** use `eslint-plugin-prettier` — it degrades performance and is discouraged by Prettier maintainers.
- **Editor integration:** `.vscode/settings.json` already exists in the template; if `editor.defaultFormatter` is not pinned to `esbenp.prettier-vscode` there, leave that up to the user — don't silently edit VS Code settings as part of reproduction.
- **New file types later (Unistyles, etc.):** Prettier picks up `.ts`, `.tsx`, `.js`, `.jsx`, `.json`, `.md`, `.yaml`, `.css` by default. No extra config needed when Unistyles adds styles or when ESLint adds flat-config TS files.
- **`.prettierignore` updates:** if Unistyles generates types under `.unistyles/` or similar, add that path to `.prettierignore` at that time.
