// Wait for the DOM to be fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const canvas = document.getElementById('tetris-canvas')
    const context = canvas.getContext('2d')
    const previewCanvas = document.getElementById('preview-canvas')
    const previewContext = previewCanvas.getContext('2d')
    const scoreElement = document.getElementById('score')
    const startButton = document.getElementById('start-button')
    const settingsDiv = document.getElementById('settings')
    const gameAreaDiv = document.getElementById('game-area')
    const widthInput = document.getElementById('width-input')
    const heightInput = document.getElementById('height-input')

    // Mobile Controls
    const leftBtn = document.getElementById('left-btn')
    const rightBtn = document.getElementById('right-btn')
    const rotateBtn = document.getElementById('rotate-btn')
    const downBtn = document.getElementById('down-btn')
    const speedDropBtn = document.getElementById('speed-drop-btn')
    const pauseBtn = document.getElementById('pause-btn')

    // --- Game Constants & Variables ---
    let BLOCK_SIZE = 20 // Will be adjusted based on screen size
    const SHAPES = [
        [[1, 1, 1, 1]], // I
        [[1, 1], [1, 1]], // O
        [[0, 1, 0], [1, 1, 1]], // T
        [[1, 1, 0], [0, 1, 1]], // S
        [[0, 1, 1], [1, 1, 0]], // Z
        [[1, 0, 0], [1, 1, 1]], // J
        [[0, 0, 1], [1, 1, 1]]  // L
    ]
    const COLORS = [
        null,       // 0 is empty
        '#FF0D72',  // I - Red
        '#0DC2FF',  // O - Blue
        '#0DFF72',  // T - Green
        '#F538FF',  // S - Purple
        '#FF8E0D',  // Z - Orange
        '#FFE138',  // J - Yellow
        '#3877FF'   // L - Indigo
    ]

    // --- LocalStorage Keys ---
    const STORAGE_KEY = 'tetris_save_v1'

    // --- Game State ---
    let board
    let score = 0
    let currentPiece
    let nextPiece
    let gameLoop
    let COLS, ROWS
    let lastTime = 0
    let dropCounter = 0
    let dropInterval = 1000 // ms
    let isPaused = false
    let particles = []
    let isSpeedDrop = false
    let dropIntervalBackup = dropInterval // Backup for speedy drop
    let isGameOver = false // 新增

    // --- Save/Load State ---
    function saveGameState() {
        if (!board || !currentPiece || !nextPiece) return
        const state = {
            board,
            score,
            currentPiece: {
                shapeIndex: getShapeIndex(currentPiece.shape),
                x: currentPiece.x,
                y: currentPiece.y,
                color: currentPiece.color
            },
            nextPiece: {
                shapeIndex: getShapeIndex(nextPiece.shape),
                color: nextPiece.color
            },
            COLS,
            ROWS,
            isPaused,
            isGameOver // 新增
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    }

    function loadGameState() {
        const data = localStorage.getItem(STORAGE_KEY)
        if (!data) return false
        try {
            const state = JSON.parse(data)
            if (!state.board || !state.currentPiece || !state.nextPiece || state.isGameOver) return false
            COLS = state.COLS
            ROWS = state.ROWS
            board = state.board
            score = state.score
            isPaused = !!state.isPaused
            isGameOver = !!state.isGameOver // 新增
            // 恢复currentPiece
            let shape = SHAPES[state.currentPiece.shapeIndex]
            let color = state.currentPiece.color
            currentPiece = new Piece(shape, color)
            currentPiece.x = state.currentPiece.x
            currentPiece.y = state.currentPiece.y
            // 恢复nextPiece
            shape = SHAPES[state.nextPiece.shapeIndex]
            color = state.nextPiece.color
            nextPiece = new Piece(shape, color)

            updateScore()
            return true
        } catch {
            return false
        }
    }

    function clearGameState() {
        localStorage.removeItem(STORAGE_KEY)
        console.log('clearGameState')
    }

    function getShapeIndex(shape) {
        for (let i = 0; i < SHAPES.length; i++) {
            if (JSON.stringify(SHAPES[i]) === JSON.stringify(shape)) return i
        }
        return 0
    }

    // --- Particle Class ---
    class Particle {
        constructor(x, y, color) {
            this.x = x
            this.y = y
            this.color = color
            this.size = Math.random() * (BLOCK_SIZE / 6) + 1
            this.life = 1 // 1 = 100%
            this.vx = (Math.random() - 0.5) * 4 // Horizontal velocity
            this.vy = (Math.random() - 0.5) * 4 // Vertical velocity
            this.gravity = 0.1
        }

        update() {
            this.x += this.vx
            this.y += this.vy
            this.vy += this.gravity
            this.life -= 0.02
        }

        draw(ctx) {
            ctx.save()
            ctx.globalAlpha = this.life
            ctx.fillStyle = this.color
            ctx.beginPath()
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
            ctx.fill()
            ctx.restore()
        }
    }

    // --- Piece Class ---
    class Piece {
        constructor(shape, color) {
            this.shape = shape
            this.color = color
            this.x = 0
            this.y = 0
        }
    }

    // --- Game Setup ---
    function startGame() {
        if (!setDimensions()) return
        isGameOver = false // 无条件重置，确保新游戏
        if (!loadGameState()) {
            board = createBoard(COLS, ROWS)
            score = 0
            nextPiece = createNewPiece()
            spawnPiece()
        }
        updateScore()
        draw()
        gameLoop = requestAnimationFrame(update)
        settingsDiv.classList.add('hidden')
        gameAreaDiv.classList.remove('hidden')
    }

    function setDimensions() {
        let userWidth = parseInt(widthInput.value)
        let userHeight = parseInt(heightInput.value)

        const maxWidth = window.innerWidth * 0.9
        const maxHeight = window.innerHeight * 0.7

        const blockSizeW = Math.floor(maxWidth / userWidth)
        const blockSizeH = Math.floor(maxHeight / userHeight)
        BLOCK_SIZE = Math.min(blockSizeW, blockSizeH, 30)

        const minBlockSize = 10
        if (BLOCK_SIZE < minBlockSize) {
            alert(`The requested dimensions (${userWidth}x${userHeight}) are too large for your screen. Please choose smaller dimensions.`)
            let suggestedWidth = Math.floor(maxWidth / minBlockSize)
            let suggestedHeight = Math.floor(maxHeight / minBlockSize)
            widthInput.value = Math.min(userWidth, suggestedWidth)
            heightInput.value = Math.min(userHeight, suggestedHeight)
            return false
        }

        COLS = userWidth
        ROWS = userHeight
        canvas.width = COLS * BLOCK_SIZE
        canvas.height = ROWS * BLOCK_SIZE

        return true
    }

    function createBoard(width, height) {
        return Array.from({ length: height }, () => Array(width).fill(0))
    }

    function createNewPiece() {
        const shapeIndex = Math.floor(Math.random() * SHAPES.length)
        const shape = SHAPES[shapeIndex]
        const color = COLORS[shapeIndex + 1]
        return new Piece(shape, color)
    }

    function spawnPiece() {
        currentPiece = nextPiece
        currentPiece.x = Math.floor(COLS / 2) - Math.floor(currentPiece.shape[0].length / 2)
        currentPiece.y = 0
        nextPiece = createNewPiece()

        if (checkCollision(currentPiece)) {
            gameOver()
        }
        drawPreview()
    }

    // --- Game Loop ---
    function update(time = 0) {
        if (isPaused || isGameOver) {
            return // 停止动画循环
        }

        const deltaTime = time - lastTime
        lastTime = time
        dropCounter += deltaTime

        if (dropCounter > dropInterval) {
            movePieceDown()
        }

        handleParticles()
        draw()
        gameLoop = requestAnimationFrame(update)
        console.log(gameLoop)
    }

    // --- Drawing ---
    function draw() {
        context.clearRect(0, 0, canvas.width, canvas.height)
        drawGrid()
        drawBoard()
        drawParticles()
        if (currentPiece) {
            drawGhostPiece(currentPiece)
            drawPiece(currentPiece)
        }
        if (isPaused) {
            drawPauseScreen()
        }
    }

    function drawPreview() {
        const PREVIEW_BLOCK_SIZE = 20
        previewCanvas.width = 4 * PREVIEW_BLOCK_SIZE
        previewCanvas.height = 4 * PREVIEW_BLOCK_SIZE
        previewContext.clearRect(0, 0, previewCanvas.width, previewCanvas.height)

        if (!nextPiece) return

        const shape = nextPiece.shape
        const color = nextPiece.color
        const shapeWidth = shape[0].length
        const shapeHeight = shape.length

        const startX = (previewCanvas.width - shapeWidth * PREVIEW_BLOCK_SIZE) / 2
        const startY = (previewCanvas.height - shapeHeight * PREVIEW_BLOCK_SIZE) / 2

        shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    draw3DBlock(
                        previewContext,
                        startX + x * PREVIEW_BLOCK_SIZE,
                        startY + y * PREVIEW_BLOCK_SIZE,
                        PREVIEW_BLOCK_SIZE,
                        color
                    )
                }
            })
        })
    }

    // 立体方块绘制函数
    function draw3DBlock(ctx, x, y, size, color) {
        // 主色
        ctx.fillStyle = color
        ctx.fillRect(x, y, size, size)

        // 渐变高光
        let grad = ctx.createLinearGradient(x, y, x + size, y + size)
        grad.addColorStop(0, 'rgba(255,255,255,0.7)')
        grad.addColorStop(0.3, color)
        grad.addColorStop(1, 'rgba(0,0,0,0.5)')
        ctx.fillStyle = grad
        ctx.fillRect(x, y, size, size)

        // 左上高光
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'
        ctx.beginPath()
        ctx.moveTo(x, y + size)
        ctx.lineTo(x, y)
        ctx.lineTo(x + size, y)
        ctx.stroke()

        // 右下阴影
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'
        ctx.beginPath()
        ctx.moveTo(x + size, y)
        ctx.lineTo(x + size, y + size)
        ctx.lineTo(x, y + size)
        ctx.stroke()
    }

    function drawGrid() {
        context.strokeStyle = 'rgba(255, 255, 255, 0.1)'
        context.lineWidth = 1
        for (let x = 0; x < COLS; x++) {
            context.beginPath()
            context.moveTo(x * BLOCK_SIZE, 0)
            context.lineTo(x * BLOCK_SIZE, canvas.height)
            context.stroke()
        }
        for (let y = 0; y < ROWS; y++) {
            context.beginPath()
            context.moveTo(0, y * BLOCK_SIZE)
            context.lineTo(canvas.width, y * BLOCK_SIZE)
            context.stroke()
        }
    }

    function drawBoard() {
        board.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value > 0) {
                    draw3DBlock(context, x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, COLORS[value])
                }
            })
        })
    }

    function drawPiece(piece) {
        piece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    draw3DBlock(
                        context,
                        (piece.x + x) * BLOCK_SIZE,
                        (piece.y + y) * BLOCK_SIZE,
                        BLOCK_SIZE,
                        piece.color
                    )
                }
            })
        })
    }

    // 新增：平面风格绘制函数，专用于 ghost
    function drawFlatPiece(piece) {
        context.save()
        context.globalAlpha = 0.25
        context.fillStyle = piece.color
        piece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    context.fillRect(
                        (piece.x + x) * BLOCK_SIZE,
                        (piece.y + y) * BLOCK_SIZE,
                        BLOCK_SIZE,
                        BLOCK_SIZE
                    )
                }
            })
        })
        context.restore()
    }

    function drawGhostPiece(piece) {
        const ghost = JSON.parse(JSON.stringify(piece)) // Deep clone
        ghost.color = 'rgba(255, 255, 255, 0.4)'

        while (!checkCollision(ghost)) {
            ghost.y++
        }
        ghost.y-- // Move back to the last valid position

        drawFlatPiece(ghost)
    }

    function drawPauseScreen() {
        context.fillStyle = 'rgba(0, 0, 0, 0.75)'
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.fillStyle = 'white'
        context.font = `bold ${BLOCK_SIZE * 1.5}px sans-serif`
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillText('Paused', canvas.width / 2, canvas.height / 2)
        saveGameState()
    }

    function drawParticles() {
        particles.forEach(p => p.draw(context))
    }

    // --- Particle Management ---
    function handleParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update()
            if (particles[i].life <= 0) {
                particles.splice(i, 1)
            }
        }
    }

    function createLineClearEffect(y, row) {
        for (let x = 0; x < COLS; x++) {
            const colorIndex = row[x] || 1
            const color = COLORS[colorIndex]
            for (let i = 0; i < 10; i++) { // 10 particles per block
                particles.push(new Particle(
                    (x + 0.5) * BLOCK_SIZE,
                    (y + 0.5) * BLOCK_SIZE,
                    color
                ))
            }
        }
    }

    // --- Movement & Collision ---
    function movePieceDown() {
        currentPiece.y++
        if (checkCollision(currentPiece)) {
            currentPiece.y--
            lockPiece()
            spawnPiece()
        }
        dropCounter = 0
        score += 1 // Increment score for each piece moved down
        updateScore()
        saveGameState()
    }

    function hardDrop() {
        // 先模拟下落，直到碰撞
        while (!checkCollision(currentPiece)) {
            currentPiece.y++
        }
        currentPiece.y--
        // 否则落到底
        // 不锁定，不spawn新方块
        updateScore()
        saveGameState()
    }

    function movePieceLeft() {
        currentPiece.x--
        if (checkCollision(currentPiece)) {
            currentPiece.x++
        }
        saveGameState()
    }

    function movePieceRight() {
        currentPiece.x++
        if (checkCollision(currentPiece)) {
            currentPiece.x--
        }
        saveGameState()
    }

    function rotatePiece() {
        const originalShape = currentPiece.shape
        const rotated = originalShape[0].map((_, colIndex) =>
            originalShape.map(row => row[colIndex]).reverse()
        )
        currentPiece.shape = rotated

        let offset = 1
        while (checkCollision(currentPiece)) {
            currentPiece.x += offset
            offset = -(offset + (offset > 0 ? 1 : -1))
            if (offset > currentPiece.shape[0].length) {
                currentPiece.shape = originalShape
                return
            }
        }
        saveGameState()
    }

    function checkCollision(piece) {
        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[y].length; x++) {
                if (piece.shape[y][x]) {
                    let newX = piece.x + x
                    let newY = piece.y + y
                    if (newX < 0 || newX >= COLS || newY >= ROWS || (newY >= 0 && board[newY][newX])) {
                        return true
                    }
                }
            }
        }
        return false
    }

    // --- Game State ---
    function lockPiece() {
        currentPiece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    board[currentPiece.y + y][currentPiece.x + x] = COLORS.indexOf(currentPiece.color)
                }
            })
        })
        clearLines()
        saveGameState()
    }

    function clearLines() {
        let linesCleared = 0
        outer: for (let y = ROWS - 1; y >= 0; y--) {
            if (board[y].every(value => value > 0)) {
                linesCleared++
                const clearedRow = board.splice(y, 1)[0]
                createLineClearEffect(y, clearedRow)
                const newRow = Array(COLS).fill(0)
                board.unshift(newRow)
                y++
            }
        }
        if (linesCleared > 0) {
            score += linesCleared * 10 * linesCleared
            updateScore()
            saveGameState()
        }
    }

    function updateScore() {
        scoreElement.textContent = score
    }

    function togglePause() {
        isPaused = !isPaused
        if (!isPaused) {
            gameLoop = requestAnimationFrame(update)
        } else {
            draw()
        }
    }

    function gameOver() {
        updateScore()
        isGameOver = true // 新增
        clearGameState()
        console.log('gameOver')
        cancelAnimationFrame(gameLoop)
        if (gameAreaDiv.classList.contains('hidden')) return // 防止多次触发
        alert(`Game Over! Your score: ${score}`)
        gameAreaDiv.classList.add('hidden')
        settingsDiv.classList.remove('hidden')
    }

    // --- Prevent text selection on mobile and desktop ---
    // document.body.style.userSelect = 'none'
    // document.body.style.webkitUserSelect = 'none'
    // document.body.style.msUserSelect = 'none'
    // document.body.style.mozUserSelect = 'none'

    // // --- Mobile: Long press down for speedy drop ---
    // let dropIntervalId = null
    // let dropActive = false
    // downBtn.addEventListener('touchstart', function(e) {
    //     e.preventDefault() // 阻止长按弹出菜单
    //     if (isPaused || !currentPiece) return
    //     dropActive = true
    //     // Start speedy drop (3x) after 300ms hold
    //     dropIntervalId = setTimeout(function() {
    //         if (dropActive && !isSpeedDrop) {
    //             isSpeedDrop = true
    //             dropIntervalBackup = dropInterval
    //             dropInterval = Math.max(50, dropInterval / 3)
    //         }
    //     }, 300)
    // }, { passive: false })
    // // 触摸松开时恢复正常速度
    // downBtn.addEventListener('touchend', function(e) {
    //     e.preventDefault();
    //     dropActive = false
    //     clearTimeout(dropIntervalId)
    //     if (isSpeedDrop) {
    //         dropInterval = dropIntervalBackup
    //         isSpeedDrop = false
    //     }
    // }, { passive: false });
    // downBtn.addEventListener('touchcancel', function(e) {
    //     e.preventDefault();
    //     dropActive = false
    //     clearTimeout(dropIntervalId)
    //     if (isSpeedDrop) {
    //         dropInterval = dropIntervalBackup
    //         isSpeedDrop = false
    //     }
    // }, { passive: false })
    // // 禁止下按钮的上下文菜单
    // downBtn.addEventListener('contextmenu', function(e) { e.preventDefault() });

    speedDropBtn.addEventListener('pointerdown', function(e) {
        if (isPaused || !currentPiece) return
        hardDrop()
    })
    pauseBtn.addEventListener('pointerdown', function(e) {
        togglePause()
    })

    // --- Event Listeners ---

    // 支持设置界面回车直接开始
    document.addEventListener('keydown', function(event) {
        if (!settingsDiv.classList.contains('hidden') && (event.key === 'Enter' || event.key === 'NumpadEnter')) {
            startButton.click()
            event.preventDefault()
        }
    })

    startButton.addEventListener('click', () => {
        startGame()
    })

    document.addEventListener('keydown', event => {
        if (event.key === 's' || event.key === 'S') {
            if (gameAreaDiv.classList.contains('hidden')) return
            togglePause()
            return
        }

        if (isPaused || !currentPiece) return

        switch (event.key) {
            case 'ArrowLeft':
                movePieceLeft()
                break
            case 'ArrowRight':
                movePieceRight()
                break
            case 'ArrowDown':
                movePieceDown()
                break
            case 'ArrowUp':
                rotatePiece()
                break
            case ' ': // Space bar
                hardDrop()
                break
        }
    })

    // 恢复正常下落速度
    document.addEventListener('keyup', event => {
        if (event.key === ' ') {
            if (isSpeedDrop) {
                dropInterval = dropIntervalBackup
                isSpeedDrop = false
            }
        }
    })

    // Mobile button listeners
    leftBtn.addEventListener('click', () => { if (!isPaused && currentPiece) movePieceLeft() })
    rightBtn.addEventListener('click', () => { if (!isPaused && currentPiece) movePieceRight() })
    downBtn.addEventListener('click', () => { if (!isPaused && currentPiece) movePieceDown() })
    rotateBtn.addEventListener('click', () => { if (!isPaused && currentPiece) rotatePiece() })
    // speedDropBtn.addEventListener('click', function(e) { if (!isPaused && currentPiece) hardDrop() })
    // pauseBtn.addEventListener('click', function(e) { togglePause() })

    // 页面加载时自动恢复
    if (loadGameState()) {
        try {
            const state = JSON.parse(localStorage.getItem(STORAGE_KEY))
            if (state.COLS && state.ROWS && !state.isGameOver) { // 只在未结束时自动恢复
                widthInput.value = state.COLS
                heightInput.value = state.ROWS
                startGame()
            }
        } catch { }
    }
})
