-- Files: the character's documents. Written on any computer, they roam with the character to
-- every other one (like Notepad's notes). A document has a typeface, headings, lists and pictures
-- out of Photos (configs/shared/photos.lua). With sd-phone linked, the phone's documents show
-- beside them (configs/shared/phone.lua > Files).
return {
    MaxFiles = 100, -- most documents one character can keep
    MaxName = 80, -- longest file name
    MaxBody = 20000, -- longest document, characters of its text (pictures and layout are not counted)
}
