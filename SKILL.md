---
name: expo-sdk55-unistyles-stack
description: Scaffold a new Expo SDK 55 React Native project with this repo's opinionated stack — Unistyles v3, ESLint 9 flat config + eslint-config-prettier, Prettier 3, expo-dev-client, smoke:min / smoke scripts, web target disabled (Tier 3). Invokes create-expo-app with a pinned template, then overlays static config files and runs identity substitution. Use when the user asks to "create a new project with this stack", "scaffold the template", or an equivalent request to reproduce this environment in a new directory.
---

# Expo RN Stack scaffolder

Deterministic scaffold for the stack documented in this repo's `recipe/01-cleanup.md` through `recipe/06-smoke.md`. Pins **Expo SDK 55**. Overlay files in `./overlay/` are copied verbatim into the target project; identity fields are substituted afterward.

## When to run

Invoke this skill when the user wants to create a new Expo project configured identically to this repo. Do **not** run to "update" an existing project — this skill creates a new project via `create-expo-app`, not to apply the stack to something else.

## Inputs to collect (ask the user before any filesystem action)

1. **`projectName`** — kebab-case, used as dir name, `package.json.name`, `app.json.slug`, `app.json.scheme`. Regex: `^[a-z][a-z0-9-]*$`.
2. **`displayName`** — human-readable, used as `app.json.name`. Default to `projectName` if the user doesn't specify.
3. **`bundleId`** — reverse-domain, used for both `ios.bundleIdentifier` and `android.package`. Regex: `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$`. Example: `com.example.myapp`.

If any value fails its regex, re-prompt the user rather than sanitizing silently.

## Re-run guard (check BEFORE scaffolding)

Abort with a clear message if either is true in the current working directory:

- A directory named `<projectName>` already exists.
- The CWD itself contains `src/unistyles.ts` or `babel.config.js` that references `react-native-unistyles/plugin` (indicates the skill has already been applied here).

On abort, suggest: "Pick a different `projectName` or `cd` to a parent directory."

## Pre-flight check (run AFTER `create-expo-app`, BEFORE overlay)

For each file the overlay will overwrite, confirm it exists and looks like the default `create-expo-app` template output:

| File                  | Quick signal it's untouched template output                                       |
| --------------------- | --------------------------------------------------------------------------------- |
| `src/app/_layout.tsx` | contains `ThemeProvider` or `AnimatedSplash` import (template's multi-tab layout) |
| `src/app/index.tsx`   | contains `Welcome to Expo` or `HintRow` import                                    |
| `babel.config.js`     | **must NOT exist** — template does not ship one by default; overlay creates it    |
| `eslint.config.js`    | **must NOT exist** — same reason                                                  |

If `babel.config.js` or `eslint.config.js` already exist, stop and tell the user: "This doesn't look like a fresh `create-expo-app` scaffold." If `_layout.tsx` / `index.tsx` no longer match the template, warn but continue — the overlay will overwrite them anyway.

## Execution steps

Run each step from the CWD the user invoked the skill from, unless explicitly told to `cd`.

### Step 1 — Scaffold fresh Expo project

```sh
npx create-expo-app@latest <projectName> --template default@sdk-55
cd <projectName>
```

Every subsequent step runs inside `<projectName>`.

### Step 2 — Cleanup (matches `recipe/01-cleanup.md`)

Delete template cruft:

```sh
rm -rf src/components src/constants src/hooks src/global.css
rm -f src/app/explore.tsx
rm -rf \
  assets/images/tabIcons \
  assets/images/react-logo.png \
  assets/images/react-logo@2x.png \
  assets/images/react-logo@3x.png \
  assets/images/expo-badge.png \
  assets/images/expo-badge-white.png \
  assets/images/expo-logo.png \
  assets/images/logo-glow.png \
  assets/images/tutorial-web.png \
  assets/images/favicon.png
rm -rf scripts
```

### Step 3 — Apply overlay

Copy every file under the skill's `overlay/` directory to the project root, preserving structure:

```sh
cp -R <skill-dir>/overlay/. .
```

Where `<skill-dir>` is the absolute path to this skill's directory (the directory containing this `SKILL.md`). Use `cp -R` with a trailing `/.` on the source so hidden files (`.prettierrc`, `.prettierignore`) are copied.

After this step, these files will exist at project root:

- `babel.config.js`, `eslint.config.js`, `.prettierrc`, `.prettierignore`
- `index.ts`
- `src/unistyles.ts`, `src/app/_layout.tsx`, `src/app/index.tsx` (overwrites template versions)

### Step 4 — Edit `package.json`

Use the `Edit` tool, not `sed`, for JSON edits. The edits are:

1. Set `"main"` to `"index.ts"` (was `"expo-router/entry"`).
2. Set `"name"` to `<projectName>`.
3. Set `"version"` to `"0.0.1"`.
4. Remove scripts: `"web"`, `"reset-project"`.
5. Add scripts in this order after `"lint"`:
   ```json
   "lint:fix": "expo lint -- --fix",
   "format": "prettier --write .",
   "format:check": "prettier --check .",
   "smoke:min": "tsc --noEmit && npm run lint && npm run format:check && npx expo-doctor",
   "smoke": "npm run smoke:min && npx expo export --platform ios --no-minify --no-bytecode --output-dir .expo/smoke-bundle && rm -rf .expo/smoke-bundle"
   ```
6. Remove from `dependencies`: `@react-navigation/bottom-tabs`, `@react-navigation/elements`, `expo-device`, `expo-glass-effect`, `expo-symbols`, `expo-web-browser`, `react-dom`, `react-native-web`.

Do **not** remove other packages (`@react-navigation/native`, `react-native-gesture-handler`, etc.). They're retained intentionally.

### Step 5 — Edit `app.json`

Use the `Edit` tool for each change:

1. Remove the entire `"web": { ... }` block.
2. Add `"platforms": ["ios", "android"]` immediately after `"userInterfaceStyle": "automatic",`.
3. Set `expo.name` to `<displayName>`.
4. Set `expo.slug` to `<projectName>`.
5. Set `expo.scheme` to `<projectName>`.
6. Set `expo.ios.bundleIdentifier` to `<bundleId>`. Create the `ios` block if absent.
7. Set `expo.android.package` to `<bundleId>`. Create the `android` block if absent.

### Step 6 — Replace `README.md`

Overwrite the template's `README.md` with a minimal one:

```markdown
# <displayName>

Scaffolded via the `expo-sdk55-unistyles-stack` skill (Expo SDK 55 + expo-router + Unistyles v3 + ESLint + Prettier + smoke scripts).

## Commands

- `npm start` — launch Metro dev server
- `npm run ios` / `npm run android` — build & run on a simulator (requires dev client, `expo prebuild` the first time)
- `npm run lint` / `npm run lint:fix`
- `npm run format` / `npm run format:check`
- `npm run smoke:min` — static + config gate (~7s)
- `npm run smoke` — `:min` plus iOS bundle export (~16s)
```

Substitute `<displayName>` literally.

### Step 7 — Install dependencies

Run in order (each must finish before the next):

```sh
npx expo install react-native-unistyles react-native-nitro-modules expo-dev-client
npm install --save-dev --save-exact prettier
npx expo install eslint eslint-config-expo eslint-config-prettier -- --save-dev
```

**Known gotcha from `recipe/04-eslint.md`:** after the ESLint install, `eslint-config-expo` will land in `dependencies` instead of `devDependencies`. Move it manually with `Edit`, then run `npm install` one more time to resync the lockfile.

### Step 8 — Verify

```sh
npm run smoke
```

Must exit `0`. Expected: `18/18 checks passed`, iOS bundle ~4.4 MB, `.expo/smoke-bundle/` deleted at the end.

If anything fails, do **not** retry blindly. Print the failing tool's output to the user and stop — the reproduction is not idempotent past this point.

### Step 9 — Report

Tell the user:

```
<projectName> created at <absolute path>.

Next steps:
- cd <projectName>
- npx expo prebuild --clean        # only if running on a real device/simulator
- npx expo run:ios                 # or run:android
- npm run smoke                    # run before every commit
```

## Notes for future maintenance of this skill

- **Overlay files are mirrors of this repo's current state.** When the source repo's `babel.config.js`, `eslint.config.js`, theme, etc. change, the overlay must be re-copied. There is no automated sync.
- **SDK pin.** `--template default@sdk-55` is intentional. When the source repo upgrades to SDK 56+, update the template flag, re-test, and re-copy overlay files.
- **Identity substitution breadth.** Current substitution touches 7 fields (see `app.json` + `package.json` changes). If the overlay adds more identity-sensitive files later (e.g., `eas.json`, iOS entitlements), expand Step 4/5 accordingly.
- **Failure recovery.** This skill does not clean up on partial failure. If Step 7 or 8 fails, the user has a half-configured project. Document this explicitly to them; don't attempt auto-rollback.
