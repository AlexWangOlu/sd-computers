---@type table Mail store module (accounts, sessions, messages); the table returned at end of file.
local mailstore = {}

---Create the mail tables if they don't exist. Messages get a row each (not sd-phone's one-JSON-blob-
---per-account), so a busy inbox never rewrites itself on every read flag. Run once at boot.
function mailstore.ensureSchema()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS computers_mail_accounts (
            email         VARCHAR(64)  NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            display_name  VARCHAR(64)  NOT NULL,
            created_by    VARCHAR(64)  NULL,
            created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (email),
            KEY idx_created_by (created_by)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ]])
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS computers_mail_sessions (
            citizenid VARCHAR(64) NOT NULL,
            email     VARCHAR(64) NOT NULL,
            PRIMARY KEY (citizenid, email),
            KEY idx_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ]])
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS computers_mail_messages (
            id           INT          NOT NULL AUTO_INCREMENT,
            owner        VARCHAR(64)  NOT NULL,
            folder       VARCHAR(16)  NOT NULL,
            prev_folder  VARCHAR(16)  NULL,
            sender_email VARCHAR(64)  NOT NULL,
            sender_name  VARCHAR(64)  NOT NULL,
            recipients   TEXT         NOT NULL,
            subject      VARCHAR(200) NOT NULL DEFAULT '',
            body         MEDIUMTEXT   NOT NULL,
            is_read      TINYINT(1)   NOT NULL DEFAULT 0,
            flagged      TINYINT(1)   NOT NULL DEFAULT 0,
            created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_owner_folder (owner, folder, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ]])
end

-- ── Accounts ──────────────────────────────────────────────────────────────────────────────

---An account row (nil when the address doesn't exist).
---@param email string
---@return table|nil row { email, password_hash, display_name }
function mailstore.account(email)
    return MySQL.single.await('SELECT email, password_hash, display_name FROM computers_mail_accounts WHERE email = ?', { email })
end

---Create an account. Returns false when the address is already taken.
---@param email string
---@param hash string password hash
---@param name string display name
---@param createdBy string citizenid of the creator
---@return boolean created
function mailstore.createAccount(email, hash, name, createdBy)
    -- INSERT IGNORE affects 0 rows when the address is taken; oxmysql's update returns that count.
    local n = MySQL.update.await(
        'INSERT IGNORE INTO computers_mail_accounts (email, password_hash, display_name, created_by) VALUES (?, ?, ?, ?)',
        { email, hash, name, createdBy })
    return (n or 0) > 0
end

---How many addresses a character has created.
---@param citizenid string
---@return integer
function mailstore.createdBy(citizenid)
    return MySQL.scalar.await('SELECT COUNT(*) FROM computers_mail_accounts WHERE created_by = ?', { citizenid }) or 0
end

-- ── Sessions (which characters are signed into which addresses) ─────────────────────────────

---Addresses a character is signed into, with display names.
---@param citizenid string
---@return table[] rows { email, display_name }
function mailstore.signedIn(citizenid)
    return MySQL.query.await([[
        SELECT a.email, a.display_name FROM computers_mail_sessions s
        JOIN computers_mail_accounts a ON a.email = s.email
        WHERE s.citizenid = ? ORDER BY a.email
    ]], { citizenid }) --[[@as table[]?]] or {}
end

---Is a character signed into an address?
---@param citizenid string
---@param email string
---@return boolean
function mailstore.isSignedIn(citizenid, email)
    return MySQL.scalar.await('SELECT 1 FROM computers_mail_sessions WHERE citizenid = ? AND email = ?', { citizenid, email }) == 1
end

---Sign a character into an address (idempotent).
---@param citizenid string
---@param email string
function mailstore.signIn(citizenid, email)
    MySQL.prepare.await('INSERT IGNORE INTO computers_mail_sessions (citizenid, email) VALUES (?, ?)', { citizenid, email })
end

---Sign a character out of an address.
---@param citizenid string
---@param email string
function mailstore.signOut(citizenid, email)
    MySQL.prepare.await('DELETE FROM computers_mail_sessions WHERE citizenid = ? AND email = ?', { citizenid, email })
end

---Every character signed into an address (for new-mail pushes).
---@param email string
---@return string[] citizenids
function mailstore.citizensOf(email)
    local out = {}
    local rows = MySQL.query.await('SELECT citizenid FROM computers_mail_sessions WHERE email = ?', { email }) --[[@as table[]?]]
    for _, r in ipairs(rows or {}) do out[#out + 1] = r.citizenid end
    return out
end

-- ── Messages ──────────────────────────────────────────────────────────────────────────────

---Store one message copy in a mailbox folder.
---@param owner string mailbox address
---@param folder string inbox|sent|drafts|bin
---@param m { senderEmail: string, senderName: string, recipients: string[], subject: string, body: string, read: boolean }
---@return integer id
function mailstore.insert(owner, folder, m)
    return MySQL.insert.await(
        'INSERT INTO computers_mail_messages (owner, folder, sender_email, sender_name, recipients, subject, body, is_read) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        { owner, folder, m.senderEmail, m.senderName, json.encode(m.recipients), m.subject, m.body, m.read and 1 or 0 })
end

---Replace a draft's contents in place.
---@param owner string
---@param id integer
---@param m table same shape as insert
---@return boolean updated
function mailstore.updateDraft(owner, id, m)
    local n = MySQL.update.await(
        "UPDATE computers_mail_messages SET recipients = ?, subject = ?, body = ?, created_at = CURRENT_TIMESTAMP WHERE owner = ? AND id = ? AND folder = 'drafts'",
        { json.encode(m.recipients), m.subject, m.body, owner, id })
    return (n or 0) > 0
end

---One folder's message headers (+ a body preview), newest first.
---@param owner string
---@param folder string
---@param search string|nil matches subject/sender/body
---@param limit integer
---@return table[] rows
function mailstore.list(owner, folder, search, limit)
    local sql = [[
        SELECT id, folder, sender_email, sender_name, recipients, subject, LEFT(body, 160) AS preview,
               is_read, flagged, UNIX_TIMESTAMP(created_at) AS ts
        FROM computers_mail_messages WHERE owner = ? AND ]]
    ---@type any[]
    local args = { owner }
    if folder == 'flagged' then
        sql = sql .. "flagged = 1 AND folder <> 'bin'"
    else
        sql = sql .. 'folder = ?'
        args[#args + 1] = folder
    end
    if search then
        sql = sql .. ' AND (subject LIKE ? OR sender_name LIKE ? OR sender_email LIKE ? OR body LIKE ?)'
        local like = '%' .. search .. '%'
        args[#args + 1] = like; args[#args + 1] = like; args[#args + 1] = like; args[#args + 1] = like
    end
    sql = sql .. ' ORDER BY id DESC LIMIT ?'
    args[#args + 1] = limit
    return MySQL.query.await(sql, args) --[[@as table[]?]] or {}
end

---One full message (nil when it isn't in this mailbox).
---@param owner string
---@param id integer
---@return table|nil row
function mailstore.get(owner, id)
    return MySQL.single.await([[
        SELECT id, folder, prev_folder, sender_email, sender_name, recipients, subject, body, is_read, flagged,
               UNIX_TIMESTAMP(created_at) AS ts
        FROM computers_mail_messages WHERE owner = ? AND id = ?
    ]], { owner, id })
end

---Set the read flag.
---@param owner string
---@param id integer
---@param read boolean
function mailstore.setRead(owner, id, read)
    MySQL.prepare.await('UPDATE computers_mail_messages SET is_read = ? WHERE owner = ? AND id = ?', { read and 1 or 0, owner, id })
end

---Set the flagged (starred) flag.
---@param owner string
---@param id integer
---@param flagged boolean
function mailstore.setFlagged(owner, id, flagged)
    MySQL.prepare.await('UPDATE computers_mail_messages SET flagged = ? WHERE owner = ? AND id = ?', { flagged and 1 or 0, owner, id })
end

---Move to the bin (remembering where it came from) or restore from it.
---@param owner string
---@param id integer
---@param toBin boolean
function mailstore.bin(owner, id, toBin)
    if toBin then
        MySQL.prepare.await("UPDATE computers_mail_messages SET prev_folder = folder, folder = 'bin' WHERE owner = ? AND id = ? AND folder <> 'bin'", { owner, id })
    else
        MySQL.prepare.await("UPDATE computers_mail_messages SET folder = COALESCE(prev_folder, 'inbox'), prev_folder = NULL WHERE owner = ? AND id = ? AND folder = 'bin'", { owner, id })
    end
end

---Delete one message for good (only from the bin or drafts).
---@param owner string
---@param id integer
function mailstore.delete(owner, id)
    MySQL.prepare.await("DELETE FROM computers_mail_messages WHERE owner = ? AND id = ? AND folder IN ('bin', 'drafts')", { owner, id })
end

---Empty a mailbox's bin.
---@param owner string
function mailstore.emptyBin(owner)
    MySQL.prepare.await("DELETE FROM computers_mail_messages WHERE owner = ? AND folder = 'bin'", { owner })
end

---Unread inbox count + per-folder totals for the folder pane.
---@param owner string
---@return table counts { unread, inbox, sent, drafts, bin, flagged }
function mailstore.counts(owner)
    local row = MySQL.single.await([[
        SELECT
            SUM(folder = 'inbox' AND is_read = 0) AS unread,
            SUM(folder = 'inbox') AS inbox, SUM(folder = 'sent') AS sent,
            SUM(folder = 'drafts') AS drafts, SUM(folder = 'bin') AS bin,
            SUM(flagged = 1 AND folder <> 'bin') AS flagged
        FROM computers_mail_messages WHERE owner = ?
    ]], { owner }) or {}
    local out = {}
    for _, k in ipairs({ 'unread', 'inbox', 'sent', 'drafts', 'bin', 'flagged' }) do out[k] = tonumber(row[k]) or 0 end
    return out
end

---Trim a folder to its newest `max` messages.
---@param owner string
---@param folder string
---@param max integer
function mailstore.trim(owner, folder, max)
    MySQL.prepare([[
        DELETE FROM computers_mail_messages WHERE owner = ? AND folder = ? AND id NOT IN (
            SELECT id FROM (SELECT id FROM computers_mail_messages WHERE owner = ? AND folder = ? ORDER BY id DESC LIMIT ?) keep
        )
    ]], { owner, folder, owner, folder, max })
end

return mailstore
