-- Bank: the character's own money, to look at - their bank balance, the cash on them and their
-- recent transactions. Nothing can be moved from here. The statement comes from sd-phone when it
-- is linked (configs/shared/phone.lua > Bank), else from the banking resource when it keeps one.
return {
    Enabled = true, -- false = the Bank app shows no computer anything (list it or not)
    TransactionLimit = 50, -- recent transactions shown and charted (100 at most)
}
