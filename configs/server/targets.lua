-- Breachable hack targets (server-only: the reward table never reaches a client). In Command
-- Prompt, `targets` lists the visible ones on that computer and `breach <command>` runs one: the
-- player plays every step's minigame in order (each verified server-side - proof floor, ordered
-- milestones, server-seeded puzzles) and the reward is paid ONLY by the server, after the last
-- step is redeemed. Field reference:
--
--   id            unique string; keys the cooldown and the System Logs entries.
--   computers     computer ids (configs/shared/computers.lua) this target is reachable from. A
--                 model computer's id covers every prop instance of it. Put HIGH-VALUE targets on
--                 LOCATION computers: world props aren't networked, so a model computer's position
--                 is reported by the client and the server can't prove a prop is really there.
--   command       what the player types after `breach` (lowercase, no spaces).
--   label         shown by `targets` and in the logs.
--   hidden        true = `targets` doesn't list it; you have to know the command (sell it as intel).
--   steps         the minigames to beat, in order: { game = <config.Hacks.Games key>, difficulty = 'easy'|'medium'|'hard' }.
--   requires      optional { item = 'name', count = 1, consume = false } the player must carry to start.
--   groups        optional job/gang allow-list (ox_target style) of who may run it.
--   cooldown      seconds the target is locked after a SUCCESSFUL breach (global, all players).
--   failCooldown  seconds one player must wait after FAILING before trying again.
--   exclusive     true = only one player can be mid-breach on this target at a time.
--   alert         optional police dispatch (bridge alert): { chance = 0-100, onFail = true|false,
--                 title, message, code, jobs = { 'police' } }. Rolls `chance` when the breach STARTS;
--                 onFail = true rolls again if it fails. Fires from the hacker's position.
--   reward        paid server-side on success; any combination of:
--                   items = { { name, count, metadata? } }
--                   money = { type = 'cash'|'bank', amount = n }
--                   mail  = { from = { name, email }, subject, body } - sent to every address the
--                           hacker is signed into (nothing if they have none - so tell them!)
--                   event = 'server:event:name' - TriggerEvent(event, src, info) for your own
--                           scripts. info = { target, computer, instance }
return {
    {
        id = 'fleeca_ledger',
        computers = { 'public_pc' },
        command = 'fleeca-ledger',
        label = 'Fleeca 银行 - 分行账本中继',
        hidden = false,
        steps = {
            { game = 'pipe', difficulty = 'medium' },
            { game = 'typing', difficulty = 'medium' },
        },
        -- requires = { item = 'trojan_usb', count = 1, consume = true },
        cooldown = 1800,
        failCooldown = 90,
        exclusive = true,
        alert = {
            chance = 50, onFail = true,
            title = '银行网络入侵', code = '10-90',
            message = 'Fleeca 报告一笔未授权的账本转账，可追溯至一台公共终端',
            jobs = { 'police' },
        },
        reward = {
            money = { type = 'cash', amount = 750 }, -- kept small: public_pc is a MODEL computer (see note above)
        },
    },

    {
        id = 'lifeinvader_creds',
        computers = { 'public_pc', 'business_laptop' },
        command = 'lifeinvader-db',
        label = 'LifeInvader - 凭据数据库',
        hidden = true, -- not listed by `targets`: the command name is the secret
        steps = {
            { game = 'maze', difficulty = 'medium' },
            { game = 'signal', difficulty = 'hard' },
            { game = 'cipher', difficulty = 'medium' },
        },
        cooldown = 3600,
        failCooldown = 120,
        exclusive = true,
        alert = { chance = 20, onFail = false, title = '数据泄露', code = '10-90', message = 'LifeInvader 报告数据库遭入侵', jobs = { 'police' } },
        reward = {
            mail = {
                from = { name = 'root', email = 'root' },
                subject = 'dump_0x7f3a.txt',
                body = '外泄完成。\n\nadmin@lifeinvader / Sp1d3rM0nk3y!\nj.chen@lifeinvader / hunter2\nbackup-svc / L1f3Inv@d3r2024\n\n连接已关闭。',
            },
            -- event = 'my-heist:server:lifeinvaderDump', -- your own server event: TriggerEvent(event, src, info)
        },
    },
}
