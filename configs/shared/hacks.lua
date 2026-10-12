return {
    -- `hack <game> [easy|medium|hard]` in Command Prompt: free practice runs that reward nothing
    -- (they're still logged to the computer's System Logs). false = only real targets can be run.
    Practice = true,
    DefaultDifficulty = 'medium',

    -- The minigame catalogue. Keys are what players type (`hack maze`); `program` is the fake
    -- executable CMD "launches"; `label` is the window title. Removing an entry hides that game
    -- from practice AND from the StartHack export.
    Games = {
        maze = { program = 'net-maze.exe', label = 'Network Maze' },
        capture = { program = 'node-grab.exe', label = 'Node Capture' },
        cipher = { program = 'cipher-lock.exe', label = 'Cipher Lock' },
        snake = { program = 'data-worm.exe', label = 'Data Worm' },
        firewall = { program = 'fw-defense.exe', label = 'Firewall Defense' },
        evasion = { program = 'highway-evade.exe', label = 'Highway Evasion' },
        typing = { program = 'code-inject.exe', label = 'Code Injection' },
        signal = { program = 'sig-replay.exe', label = 'Signal Replay' },
        pipe = { program = 'pipe-route.exe', label = 'Packet Routing' },
        breakout = { program = 'ice-break.exe', label = 'ICE Breaker' },
    },

    -- Difficulty presets: each game's knobs per difficulty. `medium` is every game's tuned default.
    -- The server derives each run's anti-cheat floor (minimum play time + required milestones)
    -- from these SAME numbers, so a tougher preset is also a longer proof-of-play.
    Presets = {
        easy = {
            maze = { width = 15, height = 11, timeLimit = 75, visibility = 7, dataNodes = 2 },
            capture = { gridSize = 8, nodeDuration = 2800, capturesRequired = 10, maxMisses = 7 },
            cipher = { timeLimit = 15, speed = 0.8, spawnRate = 0.8, playerLives = 2 },
            snake = { nodesRequired = 12, initialSpeed = 110, gridCols = 24, gridRows = 12 },
            firewall = { rows = 3, cols = 6, waves = 2, speed = 0.8, timeLimit = 0, fireRate = 0.5, playerLives = 2, shootCooldown = 220 },
            evasion = { timeLimit = 30, speed = 0.8, spawnRate = 0.8, roadWidth = 36, playerLives = 2 },
            typing = { stringLength = 7, timePerString = 7500, stringsRequired = 8, playerLives = 4 },
            signal = { sequenceLength = 5, startLength = 3, flashSpeed = 0.85, inputWindow = 1.3, playerLives = 2 },
            pipe = { gridWidth = 6, gridHeight = 5, timeLimit = 60, rounds = 1, playerLives = 3 },
            breakout = { rows = 3, cols = 8, ballSpeed = 0.85, paddleWidth = 130, timeLimit = 0, playerLives = 4 },
        },
        medium = {
            maze = { width = 21, height = 15, timeLimit = 60, visibility = 5, dataNodes = 3 },
            capture = { gridSize = 10, nodeDuration = 2200, capturesRequired = 15, maxMisses = 5 },
            cipher = { timeLimit = 20, speed = 1.0, spawnRate = 1.0, playerLives = 1 },
            snake = { nodesRequired = 20, initialSpeed = 88, gridCols = 28, gridRows = 13 },
            firewall = { rows = 4, cols = 8, waves = 3, speed = 1.0, timeLimit = 0, fireRate = 0.8, playerLives = 1, shootCooldown = 250 },
            evasion = { timeLimit = 50, speed = 1.0, spawnRate = 1.0, roadWidth = 34, playerLives = 1 },
            typing = { stringLength = 10, timePerString = 6000, stringsRequired = 12, playerLives = 3 },
            signal = { sequenceLength = 6, startLength = 3, flashSpeed = 1.0, inputWindow = 1.0, playerLives = 1 },
            pipe = { gridWidth = 8, gridHeight = 6, timeLimit = 50, rounds = 1, playerLives = 2 },
            breakout = { rows = 4, cols = 10, ballSpeed = 1.0, paddleWidth = 100, timeLimit = 0, playerLives = 3 },
        },
        hard = {
            maze = { width = 29, height = 19, timeLimit = 60, visibility = 4, dataNodes = 4 },
            capture = { gridSize = 12, nodeDuration = 1700, capturesRequired = 20, maxMisses = 3 },
            cipher = { timeLimit = 30, speed = 1.25, spawnRate = 1.25, playerLives = 1 },
            snake = { nodesRequired = 28, initialSpeed = 72, gridCols = 32, gridRows = 15 },
            firewall = { rows = 5, cols = 9, waves = 4, speed = 1.2, timeLimit = 0, fireRate = 1.1, playerLives = 1, shootCooldown = 280 },
            evasion = { timeLimit = 60, speed = 1.25, spawnRate = 1.2, roadWidth = 28, playerLives = 1 },
            typing = { stringLength = 12, timePerString = 5000, stringsRequired = 15, playerLives = 2 },
            signal = { sequenceLength = 8, startLength = 4, flashSpeed = 1.2, inputWindow = 0.85, playerLives = 1 },
            pipe = { gridWidth = 10, gridHeight = 7, timeLimit = 55, rounds = 2, playerLives = 1 },
            breakout = { rows = 5, cols = 12, ballSpeed = 1.2, paddleWidth = 85, timeLimit = 0, playerLives = 2 },
        },
    },
}
