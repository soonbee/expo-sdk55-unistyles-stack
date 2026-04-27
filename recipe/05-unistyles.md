# 05. Unistyles v3 setup

Audience: AI agents reproducing this setup. Prerequisites: `01-cleanup.md`, `02-disable-web.md`, `03-prettier.md`, and `04-eslint.md` applied.

## Context

- Goal: replace React Native's built-in `StyleSheet` with `react-native-unistyles` v3, so themed + responsive styling is available from a single source.
- **Critical constraint — Expo Go is not compatible.** Unistyles v3 uses `react-native-nitro-modules` (JSI-bound C++ core), which requires native code in the app binary. The app runs only as a **dev client build** (local `expo prebuild` + native build, or EAS Build with a development profile).
- Verification in this step goes **only up to Metro bundling**. Launching on a device is an out-of-scope follow-up.

## Step 1 — Install packages

```sh
npx expo install react-native-unistyles react-native-nitro-modules expo-dev-client
```

Why each:

| Package                      | Role                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| `react-native-unistyles`     | The styling library itself                                                                              |
| `react-native-nitro-modules` | Mandatory JSI runtime that Unistyles v3 binds to                                                        |
| `expo-dev-client`            | Adds dev menu / Metro reconnect UI to the dev build; aligns `expo start` with the dev-client URL scheme |

At the time of writing this pins: `react-native-unistyles@^3.2.4`, `react-native-nitro-modules@^0.35.5`, `expo-dev-client@~55.0.28`. On reproduction, accept whatever `expo install` resolves for the SDK.

## Step 2 — Generate and edit `babel.config.js`

The template ships without a babel config. Materialize it:

```sh
npx expo customize babel.config.js
```

Replace the generated file with:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [['react-native-unistyles/plugin', { root: 'src' }]],
  };
};
```

Key points:

- **`root: 'src'`** matches this project's layout (the Expo Router app dir is `src/app`, and any future components will live under `src/`). Do not use `'.'` or `''` — both resolve to the project root and the plugin silently stops processing styles.
- **Plugin ordering with React Compiler:** `app.json` has `experiments.reactCompiler: true`, so `babel-preset-expo` injects `babel-plugin-react-compiler` via its preset. Babel runs `plugins` before `presets`, so the Unistyles plugin listed here automatically runs before React Compiler. No extra reshuffling required.
- **Reanimated plugin is intentionally omitted.** Reanimated is installed as a transitive Expo default, but no code in `src/` uses it yet. When introducing animations with Reanimated 4 / worklets later, add `['react-native-worklets/plugin']` **after** the Unistyles plugin (still before any React Compiler plugin if you add one manually).

## Step 3 — Create `src/unistyles.ts`

Single-theme (light) configuration with breakpoints and TypeScript augmentation:

```ts
import { StyleSheet } from 'react-native-unistyles';

const lightTheme = {
  colors: {
    background: '#FFFFFF',
    text: '#1B140C',
    primary: '#007AFF',
  },
  gap: (v: number) => v * 8,
} as const;

const breakpoints = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
} as const;

type AppThemes = {
  light: typeof lightTheme;
};
type AppBreakpoints = typeof breakpoints;

declare module 'react-native-unistyles' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface UnistylesThemes extends AppThemes {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}

StyleSheet.configure({
  themes: {
    light: lightTheme,
  },
  breakpoints,
  settings: {
    initialTheme: 'light',
  },
});
```

Decisions embedded here:

- **Single `light` theme** — keeps the initial surface minimal. To add `dark` later, define the theme, add it to `themes`, extend `AppThemes`, and switch `initialTheme` → `adaptiveThemes: true` so the OS color scheme drives selection (`initialTheme` and `adaptiveThemes` are mutually exclusive).
- **Bootstrap-style breakpoints** — common enough that most third-party examples use the same scale.
- **`eslint-disable-next-line @typescript-eslint/no-empty-object-type`** — the module-augmentation pattern (`interface Foo extends Bar {}`) is Unistyles' documented way to register types, but the preset we inherit flags empty-body interfaces. Local disable is narrower than a file-level or project-level override.
- **`as const` on the theme and breakpoints** — gives precise literal types so `theme.colors.primary` narrows to `'#007AFF'` (enables autocompletion of hex values where callers want exact matches).

## Step 4 — Create the root entry `index.ts` and update `package.json`

`StyleSheet.configure` must run before any `import` in the Expo Router entry. The standard Unistyles approach is a root-level entry that imports the config first, then delegates to Expo Router.

Create `./index.ts`:

```ts
import './src/unistyles';
import 'expo-router/entry';
```

Edit `package.json`:

```diff
- "main": "expo-router/entry",
+ "main": "index.ts",
```

Order is important — swapping the two imports means `expo-router` loads first, components call `StyleSheet.create(...)` before Unistyles is configured, and you get the runtime error `Unistyles was loaded but not configured`.

## Step 5 — Migrate `src/app/index.tsx`

Swap React Native's `StyleSheet` import for Unistyles' and accept the theme in the style factory:

```tsx
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Hello, Expo!</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  text: {
    color: theme.colors.text,
  },
}));
```

`View` and `Text` still come from `react-native` — only the `StyleSheet` import changes. The Unistyles babel plugin rewrites the component to subscribe to theme/breakpoint changes at compile time.

## Step 6 — No changes needed to Prettier / ESLint

- The babel plugin is an in-memory transform; it creates no files in the repo. `.prettierignore` and `eslint.config.js` stay untouched.
- Lint warnings from the type augmentation pattern are suppressed via the two `eslint-disable-next-line` comments in `src/unistyles.ts` (Step 3). Do **not** add a file-level override unless additional empty-interface augmentations appear elsewhere.

## Step 7 — Verify

```sh
npx tsc --noEmit
npm run lint
npm run format:check
npx expo start --port 8085   # then Ctrl+C once you've confirmed the bundle
```

Optional one-shot bundle exercise (useful inside scripted reproduction):

```sh
# Start Metro in one terminal:
npx expo start --port 8085

# In another terminal, force a full bundle via HTTP:
curl -s -o /tmp/expo-bundle.js -w "HTTP %{http_code}  size=%{size_download}\n" \
  "http://localhost:8085/index.bundle?platform=ios&dev=true&hot=false&minify=false"
```

Expected output signals:

- `tsc` / `lint` / `format:check` all exit `0`.
- Metro log shows `Using src/app as the root directory for Expo Router`, `React Compiler enabled`, and `iOS Bundled <N>ms index.ts (<~1300> modules)` without any `Unistyles was loaded but not configured` warning.
- The bundle HTTP request returns `200` with ~7 MB dev bundle (size will vary by SDK/RN version).

If the bundle contains a runtime error like `Unistyles was loaded but not configured`, recheck Step 4 — the two imports in `index.ts` must be in the exact order shown, and `package.json`'s `"main"` must point at `index.ts`.

## Running on a device (out of scope, informational)

Because Expo Go lacks the nitro-modules native dependency, the app cannot load in Expo Go. Either path below is sufficient — we do **not** execute either of them in this reproduction step.

### Option A — Local prebuild + run (requires local native toolchain)

```sh
npx expo prebuild --clean
npx expo run:ios       # needs Xcode
npx expo run:android   # needs Android SDK / NDK
```

After prebuild, `ios/` and `android/` are generated at the repo root. Decide separately whether those directories will be committed or kept under `.gitignore` (continuous native generation vs. ejected).

### Option B — EAS Build development profile

```sh
eas build --profile development --platform ios
eas build --profile development --platform android
```

Requires an Expo account and `eas.json`. Builds a dev client binary in the cloud; no local Xcode / Android Studio needed.

Either path produces a binary that includes `react-native-nitro-modules` + `expo-dev-client`, after which `npx expo start` attaches to the installed app via the dev-client URL scheme.

## Known pitfalls

- **`root` path.** Setting the Unistyles babel plugin's `root` to `.` / `''` / project root silently disables style processing. Use the source-code directory (`src` here).
- **Import order in `index.ts`.** `'./src/unistyles'` must come before `'expo-router/entry'`. Reversing them surfaces as "not configured" errors at first render.
- **`package.json` `"main"`.** Must be `"index.ts"` after this step. Reverting to `"expo-router/entry"` bypasses the configuration file and breaks styling.
- **React Compiler order.** When adding further babel plugins (including a user-managed React Compiler setup), keep `react-native-unistyles/plugin` at index 0 — anything that reorganizes component bodies needs Unistyles to have run first.
- **Reanimated plugin omitted intentionally.** Add it only when the app actually uses Reanimated. For Reanimated 4+ use `react-native-worklets/plugin`, not the legacy `react-native-reanimated/plugin`.
- **Lint warnings on empty interfaces.** The two `declare module` interfaces in `src/unistyles.ts` are module augmentations; keep the inline `eslint-disable-next-line @typescript-eslint/no-empty-object-type` rather than disabling the rule globally.
- **Expo Go attempts.** Opening the project via the Expo Go app on a phone will fail to boot once Unistyles is wired in. This is expected. Use a dev client build (Option A or B above) instead.

## Notes for future steps

- **`06-smoke.md`** should add `npx tsc --noEmit && expo lint && prettier --check .` as a composite gate. Running Metro inside the smoke script is not practical; if desired, run the `curl` bundle exercise from Step 7 in CI behind a flag.
- **Adding `dark` theme later**: define `darkTheme`, extend `AppThemes`, set `themes: { light, dark }`, and change `settings` to `{ adaptiveThemes: true }` (remove `initialTheme`). The `app.json` already declares `userInterfaceStyle: "automatic"`, so the OS value will be picked up.
- **Web CSS variables**: `settings.CSSVars: true` in `StyleSheet.configure` emits CSS custom properties on the web target. Add only if the web surface needs runtime theme switching without re-render.
- **Edge-to-edge insets**: `react-native-edge-to-edge` is required if you want `rt.insets` values inside Unistyles rules. Not installed here; add per-feature when needed.
