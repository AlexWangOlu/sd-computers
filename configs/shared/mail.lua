return {
    -- Every address is <username>@<Domain>. Changing it later orphans existing accounts (their
    -- addresses keep the old domain), so pick it before players sign up.
    Domain = 'lsmail.com',

    -- Accounts are SHARED, not per-character: anyone who knows an address's password can sign in
    -- to it from any computer (good for company inboxes and for stolen-credential RP).
    MaxSignedIn = 5, -- addresses one character can be signed into at once
    MaxCreatedPerCharacter = 3, -- addresses one character may ever create

    -- Compose limits (the UI enforces these too; the server re-checks every one).
    MaxRecipients = 20,
    MaxSubject = 200, -- characters
    MaxBody = 10000, -- characters
    MinPassword = 6,
    MaxDisplayName = 40,

    -- Mail Delivery Subsystem: a mail to an address that doesn't exist bounces back to the
    -- sender's inbox, like real mail. false = unknown recipients are dropped silently.
    Bounce = true,

    -- New-mail toasts: a signed-in recipient sitting at a computer always gets the in-OS toast.
    -- true = recipients who are NOT at a computer also get a normal notification.
    NotifyOffComputer = true,
}
