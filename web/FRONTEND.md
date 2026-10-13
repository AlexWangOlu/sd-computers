# sd-computers web - conventions + app contracts

React 19 + Vite 6 + TypeScript + Tailwind 3 + zustand. SD OS, a desktop OS rendered as FiveM NUI.
`npm run dev` runs the whole OS in a browser against mock data; `npm run build` writes
`web/build` for the game. The OS shell (lock screen, desktop, taskbar, Start, windows, toasts) lives
in `src/os/`; every app is a folder in `src/apps/<id>/` whose `index.tsx` default-exports the app.
The `/computeradmin` panel is NOT part of the OS: it is a second page (`admin.html`, `src/admin/`)
built from sd-bombs' admin UI with that project's own stylesheet (`src/admin/styles.css`, the
`sc-*` classes), so the two never share CSS.
Nothing below applies to it; its strings are `src/admin/strings.en.json` (-> `ui.admin`).

The OS is a page too (`os.html`), and both are frames of the resource's NUI page (`index.html`,
`src/host/`), which passes each the messages Lua sends and puts the OS where the player is looking:
over the whole window, or - with the camera up at a computer's prop - exactly over that prop's
screen. On a prop the frame is 900px tall in its own pixels, as wide as the screen's shape makes
it (about 1230px on a monitor, 1500px on a laptop), and scaled to fit. Inside the frame none of
that shows: `window.innerWidth`, `vh` and the pointer's coordinates are all the OS's own, so an app
is written exactly as if it filled the display. It only has to cope with that window being smaller
than a 1080p one, which the shell already clamps windows to.

## Rules for app code

- **Runtime is Chromium 103** (FiveM's CEF - check `navigator.userAgent` in game). Vite targets
  `chrome103` for syntax, but nothing polyfills APIs: no `toSorted/toReversed/toSpliced/with`,
  `Object.groupBy`, `Promise.withResolvers`, CSS `:has()`, `color-mix()`, `dvh/svh` units,
  container queries, `text-wrap: balance`.

- **Look like one modern desktop OS.** Use the kit in `src/ui/controls.tsx` (Button, IconButton,
  TextInput, TextArea, Select, Toggle, Spinner, InfoBar, Card, NavItem, Badge, Dialog, Empty) and
  the Tailwind tokens from `tailwind.config.js` - `bg-win` (window base), `bg-layer` (content
  layer), `bg-card`/`hover:bg-card-hover`, `bg-subtle` (hover of subtle buttons), `border-stroke`,
  `text-t1/t2/t3`, `bg-accent text-accent-on`, `text-accent-text`, `text-success/caution/critical`,
  `rounded-ctl` (4px controls) / `rounded-win` (8px cards), `text-caption/body/subtitle/title/hero`,
  `font-mono`. **Never hard-code colours** for UI chrome (dark + light theme and the user's accent
  must both work). Icons: `lucide-react` (size 16 in lists/toolbars). App icons: `AppIcon` from
  `src/os/icons.tsx`.
- **Layout:** an app fills its window body (`h-full w-full`), owns its scrolling (`overflow-y-auto
  os-scroll`), and must work from ~640x420 up to maximized. Typical app = left navigation pane
  (~240-280px, `bg-win`) + content area (`bg-layer` with rounded top-left `rounded-tl-win` and
  `border-t border-l border-stroke`). Modal confirmations use `<Dialog>` (it renders inside the
  window: give the app root `relative`).
- **Motion:** nothing snaps. State changes ease on their own: the baseline rule in the Motion
  section of `src/styles.css` gives every button, input, `ctl-*` control and anything carrying a
  `hover:` / `focus:` / `active:` class a 150ms transition, so no `transition-colors` just for a
  hover. Things that appear take a class: `pop-in` (+ an `origin-*` utility) on menus and popovers,
  `page-in` on content swapped into a pane (key it by what it shows), `fade-in` on scrims,
  `dialog-in` on a hand-rolled dialog card (`<Dialog>` animates by itself). Things that disappear
  take a ref: `useExitFx('pop-out' | 'fade-out' | 'fly-out')` from `src/hooks/useExitFx.ts` plays
  the way out on a clone after React has removed the element. Don't put a transform animation on
  an element placed with a Tailwind translate (`-translate-x-1/2`) - the keyframes replace it.
  Retro switches all of this off in its stylesheet; mac overrides what it wants its own way.
- **Props:** every app gets `{ win }` (`AppProps` from `src/apps/registry.tsx`); `win.props` may
  carry launch arguments (e.g. Mail opened from a toast gets `{ mailbox, messageId }`).
- **Server calls:** `rpc<T>(endpoint, payload)` from `src/nui/rpc.ts` -> `Promise<{ ok, data?, error? }>`.
  `error` is already a localized, user-facing sentence: show it (InfoBar or inline). Never assume
  ok. Show a Spinner while loading.
- **Mocks:** every endpoint your app calls needs a handler in `src/nui/mock/<file>.ts` (shape below,
  realistic data, state kept in module-level variables so actions persist during a dev session).
  Use `ok(data)` / `fail(message)` from `./index`.
- **Strings:** all user-visible text via `t('ui.<app>.<key>', ...args)` from `src/i18n` (`%s`
  placeholders). Put your app's strings in `src/apps/<app>/strings.en.json` as the subtree under
  `ui.<app>` (e.g. Mail's file holds `{ "inbox": "Inbox", ... }` used as `t('ui.mail.inbox')`). Run
  `node scripts/merge-strings.mjs` (from `web/`) to merge every fragment into `../locales/en.json`.
  Shared strings already exist under `ui.common.*` (cancel, ok, save, close, loading, retry,
  refresh, search, delete, yes, no, error, no_response).
- **Global state:** `useOS` (`src/store/os.ts`): `payload` (OpenPayload, see `src/types.ts`),
  `settings` ({ theme, wallpaper, accent }), `updateSettings(patch)` (persists via rpc),
  `openApp(id, props?)`, `openWindow(spec)`, `close(id)`, `toast({ app, title, body, onClick })`.
  Live pushes: `useBus('mail:received', fn)` from `src/lib/bus.ts`.
- **Formatting:** `src/lib/format.ts` - fmtTime, fmtShortDate, fmtLongDate, fmtStamp, fmtMailDate,
  fmtAgo, fmtMoney, fmtDuration, useNow. 12/24h comes from `payload.desktop.clock24`.
- **Shared files** (`src/os/*`, `src/store/*`, `src/ui/*`, `src/nui/rpc.ts`,
  `src/nui/mock/index.ts`, `src/types.ts`, `src/apps/registry.tsx`, `src/apps/hack/*`) belong to
  the shell and every app at once. An app keeps the helpers and components it needs inside its own
  folder rather than adding to them.
- **Seen from the room:** what an app draws is also shown, live, on the computer's prop to players
  standing near it (`src/mirror` records the page, `src/screen` replays it). It needs nothing from
  an app, with three things to know: a secret goes in `<input type="password">` (masked before it
  leaves), anything that must never be seen gets the class `mirror-block`, and a `<canvas>` is not
  part of the page's markup - its picture is sampled a few times a second, so keep one inside
  `.os-root` and give it `width`/`height` attributes.
- **Verify:** `npx tsc --noEmit` must come back clean. While working on one app,
  `npx tsc --noEmit 2>&1 | grep "src/apps/<yourapp>\|src/nui/mock/<yourmock>"` narrows it to yours.

## Server contracts (server/computers/*.lua) - exact shapes

### Mail (`mail.lua`) - app id `mail`
- `mail:state` {} -> `{ domain, accounts: [{ email, name, counts: { unread, inbox, sent, drafts, bin, flagged } }], canSignIn, canCreate }`
- `mail:list` { email, folder: 'inbox'|'sent'|'drafts'|'bin'|'flagged', search? } -> `{ messages: Message[], counts }`
- `mail:read` { email, id } -> `Message` (with `body`; server marks it read)
- `mail:send` { from, to: string[] | 'a, b', subject, body, draftId? } -> `{ delivered: string[], failed: string[] }` (unknown addresses bounce back as an inbox message from "Mail Delivery Subsystem")
- `mail:draft` { from, to, subject, body, draftId? } -> `{ id }`
- `mail:flag` { email, id, flagged } / `mail:markRead` { email, id, read } / `mail:bin` { email, id, bin: true|false (false = restore) } / `mail:delete` { email, id } (bin/drafts only) / `mail:emptyBin` { email } -> ok
- `mail:signUp` { username, password, name } -> `{ email }` (creates username@domain and signs in) ; `mail:signIn` { email, password } -> `{ email }` ; `mail:signOut` { email } -> ok
- `Message` = `{ id, folder, from: { email, name }, to: string[], subject, preview, body?, read, flagged, ts }` (ts = unix seconds)
- Limits: `useOS(s => s.payload!.mail)` = { domain, maxRecipients, maxSubject, maxBody, minPassword, maxDisplayName }. A bare username in To gets @domain appended server-side.
- Push: `useBus('mail:received', d)` with `d = { mailbox, message: { id, senderName, senderEmail, subject, preview } }`.
- **Phone mail** (`payload.mail.phone === true`, optional sd-phone link - `server/computers/phonemail.lua`): same endpoints and shapes, but message ids are STRINGS (`MailId = number | string`), there is a `spam` folder (`foldersFor(phone)`), `Message.attachments?` / `hasAttachments?` can be set, and the domain/limits are sd-phone's.

### Business Manager (`boss.lua`) - app id `boss`
- `boss:overview` {} -> `{ job: { name, label }, grades: [{ level, name, isboss }], myGrade, myCid, hireById, counts: { total, online, onDuty }, funds: { available, balance?: number|null, transactions?: Tx[], depositFrom?: string[], withdrawTo?: string, max?: number } }`
- `Tx` = `{ id, title, amount, kind: 'deposit'|'withdraw'|string, issuer, receiver, message, time }` (newest first, time = unix seconds)
- `boss:employees` -> `[{ cid, name, grade, gradeName, online, onDuty }]` (highest grade first)
- `boss:setGrade` { cid, grade } / `boss:fire` { cid } -> ok. Rules (server-enforced, mirror them in UI): never yourself (`myCid`), only people with grade < myGrade, only to grades < myGrade.
- `boss:nearby` -> `[{ id, name }]` players near the computer who can be hired
- `boss:hire` { id, byId? } -> `{ name }` - the target gets an accept/decline prompt; the call can take up to ~20s (show a pending state); declined -> error. Without `byId` the target must be near the computer (one of `boss:nearby`); with `byId: true` (only when `overview.hireById`) `id` is any online player's server id, wherever they are - not online, already employed here, yourself, or an offer already on their screen -> error. Their name is only in the reply: nothing resolves an ID to a name before they accept.
- `boss:deposit` { amount, from: one of depositFrom } -> `{ balance }` ; `boss:withdraw` { amount } -> `{ balance }`

### Event Viewer (`shell.lua` logs:*) - app id `logs`
- `logs:page` { filter?: { level?, source?, search?, beforeId? } } -> `{ entries: Entry[], counts: { [level]: n }, sources: string[], pageSize, canClear, computer: { hostname, label } }`
- `Entry` = `{ id, level: 'information'|'warning'|'error'|'success'|'failure', source, event_id, message, actor_name, data, ts }` (newest first; `success`/`failure` = Audit Success / Audit Failure; `data` = optional object of extra details)
- `logs:clear` -> ok (only when canClear; afterwards the log holds a single 1102 "The audit log was cleared" entry)
- Sources the server writes: Security (logon 4624/4625/4634/4740, breaches 7101/7102/7103), Shell (1000 app start), Mail (3001-3004), Business (6001-6005), Hack (7001/7002 practice runs), Cameras (8001, the first look at each camera in a session), Eventlog (1102), plus any other resource name (9000, via the AddLog export).

### Command Prompt (`shell.lua` cmd:sysinfo + `hacks.lua`) - app id `cmd`
- `cmd:sysinfo` -> `{ hostname, ip, mac, label, user, domain, os, build, uptime }`
- `hack:targets` -> `[{ command, label, steps, cooldown, busy, requires: string|null }]` (cooldown = seconds left, 0 = ready)
- `hack:breach` { command } -> `{ id, label, steps: [{ game, difficulty, program, label }] }`
- `hack:start` { breach: id } (next step of that breach) or { game, difficulty } (practice) -> `HackRun` (`src/types.ts`; breach runs carry `step`/`total`)
- `hack:abort` { breach } -> ok (abandon between steps; counts as a failed breach)
- Games + practice switch: `useOS(s => s.payload!.hacks)` = { practice, defaultDifficulty, games: { [key]: { program, label } } }
- Playing a run: open a hack window and wait for its result:
  `useOS.getState().openWindow({ id: 'hack:' + run.token, app: 'hack', title: run.program, w: 1180, h: 780, props: { run, onResult } })`
  where `onResult(r: HackResult)` (from `src/apps/hack/HackRunner.tsx`) gets `{ won, data?: { done?, next?, total? }, error?, aborted? }`.
  The window does advance/submit/fail itself. Won + `data.done === false` -> start the breach's next step; won + done -> breach complete (reward paid server-side); lost/aborted -> the server already ended the breach.

### Notepad (`shell.lua` notes:*) - app id `notepad`
- `notes:list` -> `Note[]` (newest edit first) ; `notes:save` { note: { id?, title, body } } -> `Note` ; `notes:delete` { id } -> ok
- `Note` = `{ id: string, title, body, updatedAt }` (max 50 notes, title 80, body 20000 chars). Notes roam with the character to every computer.

### Settings (no endpoints of its own)
- `useOS(s => s.settings)` / `useOS.getState().updateSettings({ theme | wallpaper | accent })` (persists via `profile:save`).
- Choices: `payload.desktop.wallpapers` ([{ id, label }]; render previews with `<Wallpaper id accent />` from `src/os/Wallpaper.tsx` inside a small `relative overflow-hidden` box), `payload.desktop.accents` (hex list). A custom wallpaper is any `https://` image URL.
- Facts for About: `payload.computer` (label, hostname, ip, id), `payload.desktop` (osName, osBuild, clock24), `payload.user` (name, initials, job).
- `win.props.page` may request an initial page: `'system' | 'personalization'`.

### Bank (`bank.lua`) - app id `bank`
- `bank:overview` {} -> `{ name, bank, cash, source: 'phone'|'banking'|'none', transactions: Tx[] }`
- `Tx` = `{ id: string, title, amount (>= 0), kind: 'deposit'|'withdraw', issuer, receiver, message, time }` (newest first, unix seconds, at most `Bank.TransactionLimit`; issuer/receiver `''` when unknown; `message` is `''` from the phone)
- Read-only, keyed off the player (`src` / `s.citizenid`), nothing in the System Logs. `source` says where the statement came from: sd-phone's banking history while it is linked, else the banking resource's personal statement, else none (balances only).

### Company Board (`board.lua`) - app id `board`
Installed per player: only for someone whose job has a board (`configs/shared/board.lua`).
- `board:state` {} -> `{ job: { name, label }, canPost, posts: Post[], roster?: Member[], limits: { maxTitle, maxBody, maxPosts } }` (refused without a board; `roster` absent on ESX)
- `Post` = `{ id, title, body, author, pinned, ts, edited? }` (pinned first, then newest; unix seconds)
- `Member` = `{ name, grade, gradeName, online, onDuty, me }` (highest grade first, no citizenids)
- `board:post` { job, title, body?, pinned? } -> `{ id, posts }` ; `board:edit` { job, id, title, body? } -> `{ posts }` ; `board:pin` { job, id, pinned } -> `{ posts }` ; `board:delete` { job, id } -> `{ posts }` (already gone = ok)
- Writes are bosses only, re-checked on every call. `job` is the board the UI is showing: one that is no longer the player's job is refused.

### Files (`files.lua`) - app id `files`
- `files:list` {} -> `{ files: FileRow[], phone: boolean, limits: { maxFiles, maxName, maxBody } }` (no text, newest-changed first; `phone` = the phone's documents can be shown too)
- `files:read` { id } -> `FileRow & { body }` ; `files:save` { id?, name, body } -> `FileRow` (no id, or an id that is gone = a new document) ; `files:rename` { id, name } -> `FileRow` ; `files:delete` { id } -> ok
- `files:phoneList` {} -> `{ files: PhoneRow[] }` ; `files:phoneRead` { id } -> `PhoneRow & { body, url?, signatures: [{ signer, signedAt }] }` (`url` for pictures only)
- `files:toPhone` { id } -> `{ id }` (copies one of mine to the phone) ; `files:fromPhone` { id } -> `FileRow` (saves a copy of a phone document)
- `FileRow` = `{ id: number, name, size, createdAt, updatedAt }` ; `PhoneRow` = `{ id: string, name, kind: 'text'|'image'|'file', size, locked, createdAt, updatedAt }` (bytes, unix seconds)
- Names are unique per character (ignoring case). Documents roam with the character; phone documents are read-only from the desk. Nothing in the System Logs.

### Browser (`browser.lua`) - app id `browser`
- `browser:sites` {} -> `{ home, sites: Site[] }` (read-only: `configs/shared/browser.lua`, sanitised - a bad entry is skipped and named in the server console)
- `Site` = `{ address, title, bookmark, url? | blocks?: Block[] }` (`url` is https only and only ever one the server listed: nothing typed reaches the real internet)
- `Block` = `{ type: 'heading'|'subheading'|'text', text }` | `{ type: 'list', items }` | `{ type: 'notice', kind, title?, text }` | `{ type: 'facts', rows: [{ label, value }] }` | `{ type: 'links', items: [{ to, label?, note? }] }` | `{ type: 'image', src, caption? }`
- `win.props.address` opens that address (in a new tab when the window is already open).

### Games - app id `games`, no server calls (best results live in `localStorage['sd_computers:games']`).

### Calculator - no server calls.

### Security Cameras (`shell.lua` cameras:*, `cameras.lua`) - app id `cameras`
Installed per player: only for someone who may watch at least one camera from this computer.
- `cameras:list` -> `[{ id, label, area? }]` the cameras this player may watch here, in config order
- `cameras:watch` { id } -> `{ id, label, area?, x, y, z, pitch, roll, yaw, fov, pan, tilt, zoom, effect }` (refused for a camera that is not on the list). The page does not call this itself in the game: it names a camera to client Lua, which asks.
- Showing a picture is client Lua's (`client/computers/cameras.lua`), through three NUI callbacks wrapped by `src/apps/cameras/feed.ts`: `computers:camera:start` { id } -> `{ ok, error? }`, `computers:camera:control` { dx?, dy?, zoom?, reset? } -> `{ ok, zoom }` (dx/dy = how far the picture was dragged, as fractions of the display), `computers:camera:stop`.
- Lua says what is on the display with the NUI event `computers:camera` `{ active, id?, label?, area?, zoom?, maxZoom? }`. While active, the page holding the OS gives it the whole display and `CameraView` hides the desktop and draws its frame over the picture.

### Phone apps (optional sd-phone link - `phoneapps.lua`)
Installed by the server only while sd-phone is started with its link file (configs/shared/phone.lua);
otherwise the apps simply aren't in `payload.computer.apps`. Every endpoint can fail with "The phone
link is unavailable right now." if sd-phone stops mid-session - show the error, offer Retry. Phone
data is the character's own: no System Logs. With `Phone.RequireLink` they are also not installed
until the character has linked their phone to the machine in Phone Link.

#### Phone Link - app id `phonelink` (`phonelink.lua`; types: `src/apps/phonelink/types.ts`)
Installed per player wherever sd-phone is linked and asks for the code (never listed in a computer's
own apps). Every endpoint replies with `LinkState` = `{ linked, since? (unix seconds), carrying,
requirePhone, unlocks: ('messages'|'notes'|'photos'|'contacts'|'files')[], digits, minutes,
code?: { expiresIn, resendIn } (seconds, from when the reply was made), computer? }`.
- `phonelink:state` {} -> `LinkState`
- `phonelink:send` {} -> `LinkState` with `code`. The code goes to the phone as a notification; refused without a phone on the player, or within `resendIn` of the last one.
- `phonelink:confirm` { code } -> `LinkState` with `linked = true` and `computer`. A wrong code is an error saying how many tries are left; the fifth uses the code up.
- `phonelink:unlink` {} -> `LinkState` with `linked = false` and `computer`.
- `computer` = `{ apps, pinned, desktopIcons }` as in the open payload: the desktop's lists after the phone's apps were installed or removed. Hand it to `useOS.getState().setApps(...)`: the icons redraw and the windows of apps that are gone close.

#### Messages - app id `messages` (types: `src/apps/messages/types.ts`)
- `messages:list` {} -> `{ conversations: ConversationRow[], contacts: Contact[], myNumber?, myName? }` (newest first)
- `messages:thread` { id } -> `Thread` (messages oldest first, up to 200)
- `messages:send` { conversation, body } -> `TextMessage` (the sent one, `from = 'me'`). `conversation` = a thread id, or a NEW number (digits) to start a 1:1. Text only, <= 1000 chars.
- `messages:read` { conversation } -> ok (marks incoming read; the phone tells the peer "seen")
- `messages:delete` { conversation } -> ok (deletes this character's copy; leaves a group)
- `TextMessage.ts` is unix MILLISECONDS. `from` = 'me' or the sender's digits. `kind` other than 'text' -> draw a label via `messagePreview(m)` (`src/apps/messages/format.ts`).
- Push: `useBus('messages:incoming', c: IncomingPush)` - `c.id` is the thread, `c.messages[0]` the new message (App.tsx already toasts it; clicking opens the app with `win.props = { conversation }`).

#### Notes - app id `notes` (types: `src/apps/notes/types.ts`)
- `phonenotes:list` {} -> `{ notes: NoteRow[] }` (newest-edited first; title = first non-empty line)
- `phonenotes:get` { id } -> `NoteFull` (body + photo URLs + sketch data URLs; media is read-only here)
- `phonenotes:save` { id?, body } -> `{ id, createdAt, updatedAt }` (no id = new note; the note's photos/sketches are kept server-side - only the text changes)
- `phonenotes:delete` { id } -> ok
- Limits: body <= 20000 chars, 200 notes per character (the phone's rules; the server returns the error).
- No push: notes edited on the phone appear on the next list refresh.

#### Photos - app id `photos` (`photos.lua`; types: `src/apps/photos/types.ts`)
- `photos:list` {} -> `{ photos: [{ id, url, ts (unix seconds), video, favorite }], capped }` (newest first, at most 200; `capped` = the phone holds more). Read-only: the gallery is looked at here, not changed.

#### Contacts - app id `contacts` (`contacts.lua`; types: `src/apps/contacts/types.ts`)
- `contacts:list` {} -> `{ contacts: Contact[] }` (by name); `Contact` = `{ id, name, number (digits), initials?, color?, avatar?, favorite, email?, address? }`
- `contacts:add` { name, number } -> `Contact` ; `contacts:remove` { number } -> `{ removed }` (every card under that number goes). Both run the phone's own actions, so the phone's rules decide: a number not in service, your own, or one already saved comes back as its error.
