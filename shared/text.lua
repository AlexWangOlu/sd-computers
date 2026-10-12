---@type table Text module; the table returned at end of file.
local text = {}

---Clip a string to at most `max` CHARACTERS without cutting a UTF-8 sequence in half (a byte
---`s:sub(1, n)` can split "é" or an emoji and store invalid UTF-8). The DB columns count characters
---(utf8mb4), so this matches them. Invalid UTF-8 input falls back to a byte clip.
---@param s any value to clip (tostring'd; nil -> '')
---@param max integer character limit
---@return string
function text.clip(s, max)
    s = s == nil and '' or tostring(s)
    local ok, len = pcall(utf8.len, s)
    if not ok or not len then return s:sub(1, max) end
    if len <= max then return s end
    return s:sub(1, utf8.offset(s, max + 1) - 1)
end

---Trim leading/trailing whitespace.
---@param s string
---@return string
function text.trim(s)
    return (tostring(s):gsub('^%s+', ''):gsub('%s+$', ''))
end

return text
