-- Server-only System Logs (Event Viewer) settings.
return {
    RetentionDays = 14, -- entries older than this are purged at boot and every 6 hours (0 = keep forever)
    PageSize = 200, -- entries per Event Viewer page

    -- Anyone signed in may READ a computer's log. Clearing it is allowed for everyone unless
    -- ClearGroups is set (e.g. { police = 3 }); a clear is itself logged as event 1102, just like
    -- a real event log, so a wiped log always shows who wiped it.
    AllowClear = true,
    ClearGroups = nil,

    -- Which happenings write an entry. Sign-in/out, hacks and Business Manager actions always do.
    AppLaunch = true, -- "Application started" each time an app window opens
    MailSent = true, -- sender/recipients/subject of every mail sent from that computer
}
