-- Server-only Business Manager settings, merged into config.Boss.
return {
    -- Society banking backend. 'auto' picks the first started of sd-banking, Renewed-Banking.
    -- Set a resource name to force one, or false to disable society funds entirely.
    Banking = 'auto',

    MaxTransfer = 1000000, -- largest single deposit/withdraw a boss can make
}
