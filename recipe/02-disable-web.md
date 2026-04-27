# 02. Disable web target

Audience: AI agents reproducing this setup. Prerequisite: `01-cleanup.md` applied.

## Context

- Goal: make "no web" explicit at the manifest level. Physical removal of web-only deps (`react-dom`, `react-native-web`) and the `favicon.png` asset already happened in step 01; this step only rewrites `app.json` and drops the `web` npm script.
- This is the **Tier 3** form of disabling web (strongest of three plausible levels). Tier 1 would only hide the npm script and `app.json` block; Tier 2 would also uninstall the packages. Tier 3 adds the explicit `platforms` manifest key on top of Tier 2.
- Because step 01 already performed the Tier-2 removal work, this file is Tier-3-minus-Tier-2 — purely config.

## Step 1 — Edit `app.json`

Two edits in the `expo` object:

1. **Remove** the `web` block (its only referenced asset `favicon.png` was deleted in step 01):

   ```diff
   -    "web": {
   -      "output": "static",
   -      "favicon": "./assets/images/favicon.png"
   -    },
   ```

2. **Add** `platforms` so the manifest declares the shipping surface. Place it next to `userInterfaceStyle` (conceptually adjacent — both are cross-platform switches):

   ```diff
    "userInterfaceStyle": "automatic",
   +"platforms": ["ios", "android"],
    "ios": { ... },
   ```

Final shape of the relevant slice:

```json
{
  "expo": {
    "name": "mobile",
    "slug": "mobile",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "mobile",
    "userInterfaceStyle": "automatic",
    "platforms": ["ios", "android"],
    "ios": { "...": "..." },
    "android": { "...": "..." },
    "plugins": ["..."],
    "experiments": { "...": "..." }
  }
}
```

Notes:

- The `platforms` array is evaluated by the `expo` CLI and surfaces-reducing tools; it does **not** change bundler behavior directly (Metro will still respond to `--platform web` if asked), but it signals intent and keeps downstream tooling consistent.
- Do **not** remove the per-platform blocks (`ios`, `android`). Those stay — `platforms` whitelists which ones are active, not which blocks exist.

## Step 2 — Edit `package.json`

Remove the `web` script. Nothing else in `scripts` changes.

```diff
     "ios": "expo start --ios",
-    "web": "expo start --web",
     "lint": "expo lint",
```

Dependencies are already correct (step 01 dropped `react-dom` and `react-native-web`). No `npm uninstall` call needed here.

## Step 3 — Verify

At this stage the smoke scripts from step 06 do not exist yet. Use the tools already available:

```sh
npx tsc --noEmit
npx expo-doctor
```

Expected:

- `tsc --noEmit` exits `0` — no type regressions from removing the `web` script or block.
- `expo-doctor` returns `X/X checks passed. No issues detected!` on SDK 55 (18/18 at the time of writing). The newly added `platforms` key does not trigger a new warning.

If `expo-doctor` complains about an orphaned `react-native-web`-adjacent config, double-check step 01 really removed both packages — the doctor text usually names the offender.

## Rollback guidance

If web support needs to come back:

1. `npx expo install react-dom react-native-web` — SDK-correct versions.
2. Restore the `app.json` `web` block (git revert, or re-add manually).
3. Remove the `platforms` key (or extend it with `"web"`).
4. Re-add the `web` npm script: `"web": "expo start --web"`.
5. Recreate `assets/images/favicon.png` — if the original is still in git history, `git checkout <commit>~1 -- assets/images/favicon.png`; otherwise regenerate from the app icon.

The cleanest rollback is a single git revert of whichever commit introduced step 01's web-removal and step 02's manifest edits.

## Notes for future steps

- **`expo install` can reinsert web deps.** Certain future packages (design-system kits, libraries that declare both `react-native-web` and `react-native` peers) will quietly pull `react-native-web` back into `dependencies`. After any `expo install`, re-run `grep -n 'react-native-web\|react-dom' package.json` and `npm uninstall` them again if they reappeared.
- **`platforms` on newer SDKs.** If a future SDK upgrade rejects the `platforms` key or reassigns its meaning, either drop the key (falling back to Tier 2) or migrate to the new field name. The Tier-2 state (no web script, no web block, no web deps) is still a valid "no web" configuration without the manifest hint.
- **Accidental web tooling reintroduction.** Any future step (analytics SDKs, error reporters) that advertises a "Next.js / web-only" path must be installed with `--no-save` or carefully filtered — mixing web-targeted runtime libraries into a native-only app produces confusing dead code paths.
- **Smoke script impact (step 06).** `smoke:full` will bundle with `--platform ios`; that choice was trivially compatible with the web-disabled state established here. If web ever returns, add a sibling `smoke:full:web` rather than switching `smoke:full` to `--platform all`.
