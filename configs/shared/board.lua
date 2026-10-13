-- Company Board: a job's notice board. Everyone in the job reads it, from any computer; its
-- bosses post, pin and remove announcements. It also lists who is on duty right now (QBCore and
-- Qbox; on ESX it is the announcements alone).
return {
    Enabled = true, -- false = the Company Board never appears

    -- Jobs that are not a company: someone in one of these does not get the app.
    NoBoard = { 'unemployed' },

    MaxPosts = 50, -- announcements kept per job (the oldest unpinned one makes room for a new one)
    MaxTitle = 80, -- longest headline
    MaxBody = 2000, -- longest announcement, characters
}
