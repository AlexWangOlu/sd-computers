-- Security Cameras: the cameras a computer can watch. The app lists the ones the player is allowed
-- to see from the computer they are sitting at; picking one plays its picture live in the app's
-- window, to look around with (the camera turns and zooms a little, like a real one on a bracket),
-- and it can be made to fill the whole display. Nobody who may not watch any camera gets the app
-- at all.
--
-- Cameras do not have to be written here: /computeradmin > Cameras puts one up in game (you fly a
-- camera to where it hangs and what you see is what it shows), names it and says which jobs may
-- watch it. Those are kept in the database. The ones listed below show in that tab too, where one
-- can be taken away and put back - this file is never written to.
--
-- Field reference:
--   id        unique string.
--   label     what the camera is called in the list ("Lobby").
--   area      the heading it is listed under ("Mission Row Police Station"). Optional.
--   coords    vec3 - where the camera is.
--   rot       vec3 - the way it looks: pitch, roll, yaw, as GetGameplayCamRot(2) gives them.
--             With Debug = true in configs/config.lua, stand where the camera goes, look the way
--             it should look and run /computer_cam: it copies a ready-made coords + rot line.
--   fov       number - how wide it sees, degrees (default 60).
--   groups    optional job/gang lock, like a computer's: { police = 0 } (name = min grade).
--             nil = anyone at a computer that has the app.
--   computers optional list of computer ids it can be watched from: { 'mrpd_frontdesk' }.
--             nil = any computer.
return {
    Enabled = true, -- false = the Security Cameras app never appears

    Pan = 60.0, -- degrees a camera turns either way from how it was set up
    Tilt = 25.0, -- degrees it tips up or down
    Zoom = 3.0, -- times it zooms in at most

    -- The look of a camera's picture:
    --   'cctv'   - black and white, grainy and dark at the edges, with scan lines: a security monitor
    --   'colour' - in colour, with the scan lines
    --   'none'   - a clean picture
    Filter = 'cctv',

    Cameras = {
        { id = 'mrpd_lobby', label = '大厅', area = '米申罗警局', coords = vec3(435.7, -987.5, 33.8), rot = vec3(-20.0, 0.0, -32.0), fov = 70.0, groups = { police = 0 } },
        { id = 'mrpd_entrance', label = '正门', area = '米申罗警局', coords = vec3(433.4, -976.6, 34.3), rot = vec3(-24.0, 0.0, 150.0), fov = 75.0, groups = { police = 0 } },
        { id = 'pillbox_reception', label = '接待处', area = '圆堡山医疗中心', coords = vec3(303.9, -590.6, 46.0), rot = vec3(-22.0, 0.0, 215.0), fov = 70.0, groups = { ambulance = 0 } },
    },
}
