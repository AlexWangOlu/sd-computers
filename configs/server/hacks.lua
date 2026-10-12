-- Server-only hack settings: anti-cheat tuning, merged into config.Hacks.
return {
    -- Proof-of-play floors: the minimum seconds a minigame must run before the server accepts a
    -- win, tuned to the fastest a human could PHYSICALLY finish - so a devtools/executor skip saves
    -- no time and a skilled player is never rejected. Formulas: server/computers/proof.lua.
    Proof = {
        MinFloor = 3.0, -- global floor-of-the-floor: no run is ever accepted faster than this
        Grace = 2.0, -- survival games (cipher, evasion): floor = timeLimit - Grace
        Safety = 0.85, -- throughput floors * this, so lag/variance never rejects a genuinely fast run
    },

    TokenTTL = 600, -- seconds a started run stays redeemable (a run older than this is void)
    StartGap = 1.0, -- seconds between two run starts by the same player (anti-spam)

    -- StartHack export (other resources): a won run mints a one-shot proof the calling resource
    -- redeems server-side with ConsumeHackProof. Unredeemed proofs expire after this many seconds.
    ProofTTL = 120,
}
