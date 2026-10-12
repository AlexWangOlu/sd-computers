-- Server-only mail settings: rate limits (per character), merged into config.Mail.
return {
    RateLimit = {
        Send = 2, -- seconds between sends
        SignUp = 30, -- seconds between account creations
        SignIn = 2, -- seconds between sign-in attempts (slows password guessing)
    },
    MaxMailbox = 500, -- messages kept per address per folder; the oldest are trimmed past this
    BounceFrom = { name = 'Mail Delivery Subsystem', email = 'mailer-daemon' }, -- @Domain is appended
}
