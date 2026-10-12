# Shell styles - contract

A computer opens in one STYLE (`payload.computer.style`: `'modern' | 'retro' | 'mac'`, chosen per
computer in `configs/shared/desktop.lua` / `computers.lua`, or forced by the OpenComputer export).
The apps (`src/apps/*`) and the server are shared; a style supplies the **shell** around them plus a
**stylesheet** that re-skins the apps.

## 0. Non-negotiable: no real brands

This is an original OS ("SD OS"). Never use or imitate a real company's logo, product name, wallpaper
or font: no Apple/apple logo, no Windows flag, no "macOS", "Mac", "Finder", "Spotlight",
"Launchpad", "Mission Control", "Windows", "Microsoft", "MS-DOS", "Program Manager", "Norton",
"IBM", "Phoenix"/"AMI"/"Award" BIOS, "Intel", "Chicago"/"Geneva"/"SF Pro"/"MS Sans Serif"/"Fixedsys"
fonts, Aqua/Sonoma/Bloom wallpapers, the "Happy Mac" face, "It is now safe to turn off your
computer". Use the SD OS mark (`OsLogo` in `src/os/icons.tsx`, or your own original variant), the
style's `payload.desktop.osName` (e.g. "SD Desktop", "SD OS Harbor") and bundled open fonts
(`@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`, `@fontsource/vt323`,
`@fontsource/pixelify-sans` are installed). Generic UI conventions (grey bevels, a top menu bar,
a dock, coloured window buttons) are fine - those are styles, not brands.

## 1. What a style exports - `src/os/<style>/index.ts`

```ts
const kit: ShellKit = { BootScreen, LockScreen, WelcomeScreen, ShutdownScreen, Desktop, Frame? };
export default kit;
```
(`ShellKit` in `src/os/shells.ts`; `Computer.tsx` renders the current phase's screen, wrapped in
`Frame` when given - e.g. retro's CRT monitor. The `.os-root` element above it carries
`data-style`, `data-theme` and the accent CSS variables.)

- `BootScreen({ onDone })` - power-on sequence, then `onDone()`. Skipped when `payload.desktop.boot`
  is false (the store starts at 'lock').
- `LockScreen({ onSignedIn })` - shows `payload.user` (name, initials, job). If
  `payload.computer.requiresPin`, ask for the PIN; call `signIn(pin?)` from `src/os/session.ts` ->
  `{ ok, error?, lockedFor? }`. Show `error`, handle `lockedFor` (seconds) as a disabled countdown
  (also initially `payload.computer.lockedFor`). On ok call `onSignedIn()`. Offer a way to power off
  (`powerOff()` from session.ts). Mirror `src/os/LockScreen.tsx`.
- `WelcomeScreen({ onDone })` / `ShutdownScreen({ onDone })` - short transitions, then `onDone()`
  (ShutdownScreen's onDone closes the NUI).
- `Desktop` - the signed-in desktop, see below.

## 2. Desktop responsibilities

- Wallpaper: `<Wallpaper id={settings.wallpaper} accent={settings.accent} />` (`src/os/Wallpaper.tsx`;
  your style's ids are drawn by `src/os/<style>/wallpapers.tsx` -> `<style>Wallpaper(id, accent)`
  returning a ReactNode or null; ids are listed in configs/shared/desktop.lua Styles).
- Desktop icons from `payload.computer.desktopIcons` (labels from `payload.computer.apps`);
  double-click / Enter opens `useOS.getState().openApp(id)`. App art: `AppIcon` from `src/os/icons.tsx`
  (you may wrap it, e.g. in a tile).
- Every window: `useOS(s => s.windows)`, each rendered through YOUR window frame with
  `const App = APPS[w.app]` (`src/apps/registry.tsx`) inside: `<App win={w} />`.
  - Active window: `useOS(selectActiveId)`. Z-order: `w.z`.
  - Store actions (`useOS.getState()`): `focus(id)`, `close(id)` (may be vetoed by a close guard -
    just call it), `minimize(id)`, `finalize(id)`, `restore(id)`, `toggleMax(id)`, `move(id,x,y)`,
    `resize(id,x,y,w,h)`, `openApp`, `openWindow`, `closeAll`, `setPhase`, `setStart(bool)`,
    `setFlyout(...)`, `toast`, `dismissToast`.
  - Exit animations: `close`/`minimize` only set `w.exit = 'close' | 'min'`; play your exit animation
    and call `finalize(w.id)` on its animationend AND from a ~350ms safety timeout (idempotent).
  - Minimized windows (`w.min`) must stay MOUNTED (render with `display:none`) - apps keep state.
  - `w.max` = maximized; `w.resizable === false` = no resize/maximize. Port the pointer-capture
    drag + 8-way resize logic from `src/os/WindowFrame.tsx` (writes to the DOM node during the
    gesture, commits once on release; contents get `pointer-events:none` mid-gesture).
  - Window coordinates are relative to your desktop container. Register its size so placement and
    clamping use it: `setBoundsProvider(() => ({ w, h }))` from `src/store/os.ts` in an effect (and
    `setBoundsProvider(null)` on unmount).
- A launcher listing `payload.computer.apps` and session actions:
  Lock = `lockSession(); setPhase('lock')`; Sign out = `lockSession(); closeAll(); setPhase('lock')`;
  Shut down = `setPhase('shutdown')` (`lockSession` from `src/os/session.ts`). `useOS(s => s.start)`
  is the generic "launcher open" flag (Ctrl+Escape toggles it; Escape closes it).
- Toasts: render `useOS(s => s.toasts)` in your style (`{ id, app, title, body, onClick }`; click runs
  onClick then `dismissToast(id)`).
- A clock: `fmtTime(useNow(), payload.desktop.clock24)` (`src/lib/format.ts`).

## 3. The style stylesheet - `src/styles/<style>.css`

Scope EVERYTHING under `.os-root[data-style='<style>']` (keyframes: prefix names with the style).
- Re-define the tokens there (see `src/styles.css`: --win-bg, --layer, --card, --card-hover,
  --control*, --subtle-hover, --stroke*, --flyout, --text-1/2/3/dis, --input, --input-focus,
  --success/caution/critical; accent: --accent / --accent-fill / --accent-fill-hover / --accent-on /
  --accent-text are written inline by `src/os/theme.ts` from the user's accent - override with
  `!important` only if the style must). Use `[data-style=...][data-theme=dark]` for dark variants.
- Re-skin every app through the control markers in `src/ui/controls.tsx`: `ctl-btn` (+ `ctl-btn-
  standard|accent|subtle|danger`), `ctl-iconbtn`, `ctl-field` (+ `ctl-textarea`, `ctl-select`),
  `ctl-toggle` (+ `is-on`), `ctl-spinner`, `ctl-infobar` (+ `-info|-success|-warning|-error`),
  `ctl-card`, `ctl-nav` (+ `is-selected`), `ctl-badge`, `ctl-dialog-shade`, `ctl-dialog`,
  `ctl-dialog-title`, `ctl-dialog-actions`, `ctl-empty`; plus the Tailwind utilities the apps use
  (`rounded-ctl`, `rounded-win`, `shadow-*`, `font-ui`, `font-mono`, `bg-win`, `bg-layer`,
  `bg-card`, `border-stroke`, ...) and scrollbars (`.os-scroll`).
- Read the apps (`src/apps/*`) to see which surfaces they use, and make every app readable and
  on-style. The CMD app (black console) and hack windows (minigame canvas) stay as they are.
- Motion: the apps' shared motion (`fade-in`, `pop-in`, `page-in`, `dialog-in`, `fly-up`, `msg-in`,
  `stagger`, the hover/press baseline and the `.exit-ghost` clones that play exits) is defined in
  the Motion section of `src/styles.css`. Leave it (modern), override a class under your scope to
  give it your own feel (mac: `.fly-up`), or switch it off: retro nulls the classes and hides
  `.exit-ghost`, and is excluded from the baseline by name. Between phases a kit either animates
  its own screens (mac, retro) or sets `crossfade` (ms) on its `ShellKit` and lets `Computer.tsx`
  dissolve them (modern).

## 4. Strings, browser dev, verification

- Shell strings: `t('ui.<style>.<key>')`, defined in `src/os/<style>/strings.en.json`, merged by
  `node scripts/merge-strings.mjs` (from `web/`). Shared: `ui.common.*`, `ui.power.*`, `ui.lock.*`.
- Runtime is **Chromium 103**: no `toSorted`/`toReversed`/`with`, `Object.groupBy`, CSS `:has()`,
  `color-mix()`, `dvh`, container queries, `text-wrap: balance`.
- Dev: `npm run dev`, then `http://localhost:5173/?style=<style>` (`#desktop` skips boot+lock,
  `#mail` etc. opens an app; mock PIN 1031).
- Verify with `npx tsc --noEmit`. A style is its folder, its stylesheet and its strings fragment:
  it should not need a change anywhere else.
