-- Security Cameras: the cameras a computer can watch. The app lists the ones the player is allowed
-- to see from the computer they are sitting at; picking one puts its picture on the whole display,
-- to look around with (the camera turns and zooms a little, like a real one on a bracket), until
-- they go back to the desktop. Nobody who may not watch any camera gets the app at all.
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
    Effect = true, -- scan lines over the picture (false = a clean picture)

    Cameras = {
        { id = 'mrpd_lobby', label = 'Lobby', area = 'Mission Row Police Station', coords = vec3(435.7, -987.5, 33.8), rot = vec3(-20.0, 0.0, -32.0), fov = 70.0, groups = { police = 0 } },
        { id = 'mrpd_entrance', label = 'Front entrance', area = 'Mission Row Police Station', coords = vec3(433.4, -976.6, 34.3), rot = vec3(-24.0, 0.0, 150.0), fov = 75.0, groups = { police = 0 } },
        { id = 'pillbox_reception', label = 'Reception', area = 'Pillbox Hill Medical Center', coords = vec3(303.9, -590.6, 46.0), rot = vec3(-22.0, 0.0, 215.0), fov = 70.0, groups = { ambulance = 0 } },
    },
}
