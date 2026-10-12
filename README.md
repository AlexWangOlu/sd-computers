# sd-computers

**SD OS**: a full desktop operating system on any computer in the city. Walk up to a configured
location or prop, sign in, and use real apps:

| App | What it does |
| --- | --- |
| **Mail** | Shared, password-protected `@lsmail.com` accounts (sign up / sign in / multiple accounts), inbox, flagged, drafts, sent, bin, reply / forward, bounces for unknown addresses, live new-mail toasts. |
| **Event Viewer** | That computer's System Logs: sign-ins and failed PINs, lockouts, apps opened, mail sent, Business Manager actions, hack attempts and breaches, plus anything other resources write. Filterable; clearing it leaves a "log was cleared by X" entry (event 1102). |
| **Command Prompt** | A real-feeling `cmd.exe` (`ipconfig`, `systeminfo`, `ping`, `tasklist`…) that launches the hacking minigames: free practice (`hack maze hard`) and configured breach targets (`targets`, `breach fleeca-ledger`) that pay rewards server-side. |
| **Business Manager** | The boss menu: roster with online/on-duty status, promote/demote/fire, hire nearby players (they get an accept prompt), society balance chart, deposit / withdraw, statement. Only shown to that job's bosses. |
| **Messages / Notes** | Only with sd-phone: the phone's texts and notes on the desktop (see "sd-phone link" below). |
| **Notepad / Calculator / Settings** | Notes that follow the character to every computer; a full standard calculator; wallpaper, accent colour and dark/light mode (saved per character). |

Lock screen with optional per-computer PIN (checked server-side, with lockout), welcome / shutdown
screens, centred taskbar, Start menu with search, draggable / resizable / snap-to-maximize windows,
calendar and quick-settings flyouts, toast notifications. Ten hacking minigames from sd-deaddrop,
with the same server-side anti-cheat (proof-of-play floors, ordered milestones, server-seeded
puzzles).

## Three looks, one computer

Every computer runs the same apps against the same server; its **style** decides the shell around them:

| Style | Name on screen | Feel |
| --- | --- | --- |
| `modern` | SD OS Pro | centred taskbar + Start menu, rounded translucent windows, dark/light |
| `retro` | SD Desktop 3.11 | a 1991 shell inside a beige CRT: DOS boot, teal desktop, bevelled grey windows that snap open in chunky steps, synthesized period sounds |
| `mac` | SD OS Harbor | top menu bar, magnifying dock, traffic-light window buttons, search overlay |

Pick it per computer with `style = 'retro'` in `configs/shared/computers.lua` (unset = `Desktop.DefaultStyle`),
or force it per open from a script: `exports['sd-computers']:OpenComputer(id, coords, { style = 'mac' })`.
Each style has its own OS name, wallpapers and accent palette (`Desktop.Styles`), and every character's
wallpaper / accent / light-dark choice is saved **per style**. All three are original designs - no real
OS logos, names, wallpapers or fonts.

## sd-phone link (optional)

sd-computers is complete on its own. If **sd-phone** is running too, a computer becomes another
screen for the character's phone:

| | With sd-phone | Without |
| --- | --- | --- |
| **Mail** | the phone's mail: the same `@lifeinvader.com` accounts, inbox (plus Spam), attachments, phone notifications and badges | built-in `@lsmail.com` Mail |
| **Messages** | new app: the phone's text threads - read, reply, start a thread to a number or contact; incoming texts toast on the desktop | not installed |
| **Notes** | new app: the phone's notes - edit the text, view their photos and sketches | not installed |

- Needs sd-phone's link file `server/compat/computers.lua` (shipped with sd-phone, one line in its
  fxmanifest). It runs the phone's own handlers, so a text sent from a desk validates, notifies and
  threads exactly like one typed on the phone.
- Detected live: start or stop sd-phone at any time and the next computer you open follows. An
  sd-phone without the link file is treated as "not installed" (one console warning).
- `configs/shared/phone.lua`: `Enabled` (`'auto'` / `false`), `Mail` / `Messages` / `Notes` switches,
  `RequirePhone` (Messages/Notes only for players carrying a phone - default on).
- Per computer: `phone = false` in `computers.lua` keeps Messages/Notes off that machine (a police
  terminal, say). Mail follows the server-wide switch so nobody sees two different inboxes.
- `SendMail`, `MailAddressExists` and `GetMailAddresses` follow the switch too: while linked they
  work on the phone's mailboxes (the ones players actually read).
- sd-phone side: `set sd_phone_computerlink "sd-computers"` lists the resources allowed to drive the
  link (default sd-computers only; `"off"` disables it).

## Requirements

- `ox_lib`, `oxmysql`, a target resource (`ox_target`, `qb-target` or `qtarget`)
- Framework: Qbox or QBCore (ESX works for everything except the Business Manager, which hides itself)
- Society funds: `sd-banking` or `Renewed-Banking` (optional - the Finances tab hides without one)
- `sd-phone` (optional - see "sd-phone link" above)

Tables are created automatically on first start: `computers_profiles`, `computers_logs`,
`computers_placed`, `computers_mail_accounts`, `computers_mail_sessions`, `computers_mail_messages`.

## Install

1. Drop `sd-computers` into your resources and `ensure sd-computers` after ox_lib / oxmysql / your
   framework / your target / your banking.
2. The UI is pre-built in `web/build`. To change it: `cd web && npm install && npm run build`.

## Configuration

Scope-by-folder, like the other sd-* resources: `configs/shared` ships to clients,
`configs/server` never does.

| File | What's in it |
| --- | --- |
| `configs/config.lua` | Locale, Debug, bridge debug prints |
| `configs/shared/computers.lua` | **The computers.** Each is a location (`coords`/`size`/`rotation`) or a `model` (every prop of that model). Optional `groups` lock, `boss` (a job name, or `true` = the signed-in player's own job), `style`, `apps` list. |
| `configs/shared/desktop.lua` | Default style, app list + window sizes, default apps, pins, desktop icons, 12/24h clock, and per style (`Styles`): OS name/build, wallpapers, accent colours, default theme, retro's CRT monitor + sounds toggles |
| `configs/shared/interact.lua` | Target label/icon/distance, typing animation, walk-away distance, debug `/computer_pos` |
| `configs/shared/admin.lua` | **The admin panel**: its command, who may open it and who may change things, the placement gizmo, and the props a computer can be placed as |
| `configs/shared/mail.lua` | Domain, account caps, compose limits, bounces, off-computer notifications |
| `configs/shared/phone.lua` | Optional sd-phone link: phone Mail, Messages + Notes apps, RequirePhone |
| `configs/shared/hacks.lua` | Minigame catalogue + easy/medium/hard presets, practice on/off |
| `configs/shared/boss.lua` | Business Manager on/off, hire radius, deposit sources, withdraw target |
| `configs/server/security.lua` | **PINs per computer** + wrong-PIN lockout |
| `configs/server/targets.lua` | **Breach targets**: which computers, the minigame steps, item requirement, cooldowns, police alert, rewards (items / money / mail / your own server event) |
| `configs/server/hacks.lua` | Anti-cheat tuning, token / proof lifetimes |
| `configs/server/logs.lua` | Retention, who may clear logs, which events get written |
| `configs/server/mail.lua` | Rate limits, mailbox size |
| `configs/server/boss.lua` | Banking backend (`auto`), max transfer |

The example coordinates (MRPD front desk, Pillbox reception) are from this server's qbx_police /
qbx_ambulancejob configs; check them in game. With `Debug = true`, aim at a keyboard and run
`/computer_pos`: it copies a ready-made `coords = vec3(...)` line.

## Admin panel

`/computeradmin` (admins) opens a panel listing every computer on the server - who is sitting at
which, its style, its job lock - and places new ones without touching a config file:

1. **Place computer**: pick the prop it stands as (`configs/shared/admin.lua` > `Props`), the style
   it opens in (`modern` / `retro` / `mac`, or the server default), a name, and optionally the jobs
   that may use it.
2. The placement gizmo takes over - the same one sd-bombs and sd-scooters use. The prop starts
   sitting on whatever you were looking at; move and turn it, **Enter** places it.
3. It is live at once for everyone, with the same "Use Computer" option as any other computer.

A placed computer can be changed (name, prop, style, jobs), moved with the gizmo, teleported to
and deleted from its row. Computers from `configs/shared/computers.lua` are listed read-only. They
are kept in the `computers_placed` table and get the ids `placed_<n>`, which is what keys their
System Logs.

Permissions are aces, like sd-bombs: `Group` (default `group.admin`) gets the command and the
edit ace `sd_computers.edit`; an optional `ViewGroup` can open the panel but not change anything.
To let another principal edit: `add_ace group.mod sd_computers.edit allow` (and
`add_ace group.mod command.computeradmin allow` to open it).

## Controls

**Esc** on the lock screen or an empty desktop stands you up; Start > Power > Shut down
does the same with the shutdown screen. **Ctrl+Esc** opens Start, **Alt+F4** closes the focused
window. Walking away closes the computer.

## Exports

### Server

```lua
-- Run a hack on a player and get a VERIFIED result (yields until they win, lose or quit).
local won = exports['sd-computers']:RunHack(source, 'maze', 'hard')

-- Or let the client run it (StartHack below) and redeem the proof it returns. One-shot, expires.
local info = exports['sd-computers']:ConsumeHackProof(source, proof, { game = 'maze', difficulty = 'medium' })
-- info = { game, difficulty, elapsed } or false

-- Write to a computer's System Logs (computer id, or '<id>@x,y,z' for one specific prop).
exports['sd-computers']:AddLog('mrpd_frontdesk', 'warning', 'sd-doors', 'Evidence locker opened', { by = 'Officer Hale' })

-- System / NPC mail (no sent copy, no bounce).
exports['sd-computers']:SendMail({ to = 'jessica.hale@lsmail.com', subject = 'Shift starts', body = 'See you at 8.', from = { name = 'LSPD HR', email = 'hr' } })
exports['sd-computers']:MailAddressExists('jessica.hale@lsmail.com')
exports['sd-computers']:GetMailAddresses(citizenid) -- addresses a character is signed into

exports['sd-computers']:GetComputers() -- { id, label, hostname, coords?, model?, placed?, prop? }[] (placed = from the admin panel)
```

Event fired after every successful breach: `AddEventHandler('sd-computers:server:breachCompleted', function(src, info) end)`
with `info = { target, computer, instance }` (each target can also name its own event).

### Client

```lua
-- Open a computer from another script (a laptop item, a phone app...). Model computers take the
-- prop's coords (default: the player's position, e.g. a held laptop). Server rules still apply.
-- Optional third argument forces a style for this open.
exports['sd-computers']:OpenComputer('business_laptop')
exports['sd-computers']:OpenComputer('public_pc', nil, { style = 'retro' })

-- Standalone hack.exe window (no computer needed). Redeem the proof on the server!
local won, proof = exports['sd-computers']:StartHack({ game = 'pipe', difficulty = 'medium', title = 'Vault Door' })
```

Games: `maze`, `capture`, `cipher`, `snake`, `firewall`, `evasion`, `typing`, `signal`, `pipe`, `breakout`.

## How the security works

- Every app action goes through one server callback (`server/computers/rpc.lua`) that checks the
  player has this computer open, is signed in, is still in reach, still passes its job lock, and has
  that app - before any handler runs.
- PINs and breach rewards live only in `configs/server/`. The client never sees them.
- Location computers are distance-checked against their config coords. Model (prop) computers
  can't be: world props aren't networked, so the prop's position comes from the client. That's
  fine for public PCs, but put valuable breach targets on location computers.
- A hack win is never trusted: the server mints the run (and, for maze / pipe / typing / signal,
  generates the puzzle), requires every milestone in order at human pace, refuses anything faster
  than the difficulty's minimum play time, and only then pays out. These are sd-deaddrop's
  `proof.lua` / `challenge.lua`.

## Development

`cd web && npm run dev` opens the whole OS in a browser with mock data (dev PIN `1031`). Hashes:
`#desktop` skips the lock screen, `#mail` / `#boss` / `#logs` / `#cmd` ... open an app, `#lib` shows a
standalone StartHack window. App contracts and UI conventions: `web/FRONTEND.md`.
The admin panel is a page of its own: `http://localhost:<port>/admin.html` shows it with mock
computers (placing "runs the gizmo" by hiding the panel for a moment).
