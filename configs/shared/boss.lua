return {
    Enabled = true, -- false = the Business Manager never appears, whatever computers.lua says

    -- Hiring: nearby players within this many metres of the COMPUTER are listed to hire. They get
    -- a confirm prompt and, on accept, join at the job's lowest grade with it as primary job.
    HireRadius = 10.0,
    -- Also let a boss send the offer to ANY player online by their server id, wherever they are.
    -- The same confirm prompt: nobody joins without accepting, and the boss is not shown their
    -- name until they do. false = only the people standing at the computer can be hired.
    HireById = true,

    -- Society funds (sd-banking / Renewed-Banking society account, keyed by job name). Hidden
    -- automatically when no supported banking resource is running.
    Funds = true,
    DepositFrom = { 'bank', 'cash' }, -- where a boss may deposit from (shown as a picker)
    WithdrawTo = 'bank', -- withdrawals land here: 'bank' or 'cash'
    TransactionLimit = 50, -- recent society transactions shown (and charted)
}
