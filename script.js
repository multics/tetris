// Wait for the DOM to be fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const canvas = document.getElementById('tetris-canvas');
    const context = canvas.getContext('2d');
    const scoreElement = document.getElementById('score');
    const startButton = document.getElementById('start-button');
    const settingsDiv = document.getElementById('settings');
    const gameAreaDiv = document.getElementById('game-area');
    const widthInput = document.getElementById('width-input');
    const heightInput = document.getElementById('height-input');

    // Mobile Controls
    const leftBtn = document.getElementById('left-btn');
    const rightBtn = document.getElementById('right-btn');
    const rotateBtn = document.getElementById('rotate-btn');
    const downBtn = document.getElementById('down-btn');
    const speedDropBtn = document.getElementById('speed-drop-btn')
    const pauseBtn = document.getElementById('pause-btn');

    // --- Game Constants & Variables ---
    let BLOCK_SIZE = 20; // Will be adjusted based on screen size
    const SHAPES = [
        [[1, 1, 1, 1]], // I
        [[1, 1], [1, 1]], // O
        [[0, 1, 0], [1, 1, 1]], // T
        [[1, 1, 0], [0, 1, 1]], // S
        [[0, 1, 1], [1, 1, 0]], // Z
        [[1, 0, 0], [1, 1, 1]], // J
        [[0, 0, 1], [1, 1, 1]]  // L
    ];
    const COLORS = [
        null,       // 0 is empty
        '#FF0D72',  // I - Red
        '#0DC2FF',  // O - Blue
        '#0DFF72',  // T - Green
        '#F538FF',  // S - Purple
        '#FF8E0D',  // Z - Orange
        '#FFE138',  // J - Yellow
        '#3877FF'   // L - Indigo
    ];

    let board;
    let score = 0;
    let currentPiece;
    let gameLoop;
    let COLS, ROWS;
    let lastTime = 0;
    let dropCounter = 0;
    let dropInterval = 1000; // ms
    let isPaused = false;
    let particles = [];
    let isSpeedDrop = false
    let dropIntervalBackup = dropInterval // Backup for speedy drop

    // --- Particle Class ---
    class Particle {
        constructor(x, y, color) {
            this.x = x;
            this.y = y;
            this.color = color;
            this.size = Math.random() * (BLOCK_SIZE / 6) + 1;
            this.life = 1; // 1 = 100%
            this.vx = (Math.random() - 0.5) * 4; // Horizontal velocity
            this.vy = (Math.random() - 0.5) * 4; // Vertical velocity
            this.gravity = 0.1;
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.vy += this.gravity;
            this.life -= 0.02;
        }

        draw(ctx) {
            ctx.save();
            ctx.globalAlpha = this.life;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // --- Piece Class ---
    class Piece {
        constructor(shape, color) {
            this.shape = shape;
            this.color = color;
            this.x = Math.floor(COLS / 2) - Math.floor(this.shape[0].length / 2);
            this.y = 0;
        }
    }

    // --- Game Setup ---
    function startGame() {
        if (!setDimensions()) return;

        board = createBoard(COLS, ROWS);
        score = 0;
        updateScore();
        spawnPiece();
        isPaused = false;
        particles = [];

        if (gameLoop) cancelAnimationFrame(gameLoop);
        lastTime = 0;
        dropCounter = 0;
        gameLoop = requestAnimationFrame(update);

        settingsDiv.classList.add('hidden');
        gameAreaDiv.classList.remove('hidden');
    }

    function setDimensions() {
        let userWidth = parseInt(widthInput.value);
        let userHeight = parseInt(heightInput.value);

        const maxWidth = window.innerWidth * 0.9;
        const maxHeight = window.innerHeight * 0.7;

        const blockSizeW = Math.floor(maxWidth / userWidth);
        const blockSizeH = Math.floor(maxHeight / userHeight);
        BLOCK_SIZE = Math.min(blockSizeW, blockSizeH, 30);

        const minBlockSize = 10;
        if (BLOCK_SIZE < minBlockSize) {
            alert(`The requested dimensions (${userWidth}x${userHeight}) are too large for your screen. Please choose smaller dimensions.`);
            let suggestedWidth = Math.floor(maxWidth / minBlockSize);
            let suggestedHeight = Math.floor(maxHeight / minBlockSize);
            widthInput.value = Math.min(userWidth, suggestedWidth);
            heightInput.value = Math.min(userHeight, suggestedHeight);
            return false;
        }

        COLS = userWidth;
        ROWS = userHeight;
        canvas.width = COLS * BLOCK_SIZE;
        canvas.height = ROWS * BLOCK_SIZE;

        return true;
    }

    function createBoard(width, height) {
        return Array.from({ length: height }, () => Array(width).fill(0));
    }

    function spawnPiece() {
        const shapeIndex = Math.floor(Math.random() * SHAPES.length);
        const shape = SHAPES[shapeIndex];
        const color = COLORS[shapeIndex + 1];
        currentPiece = new Piece(shape, color);

        if (checkCollision(currentPiece)) {
            gameOver();
        }
    }

    // --- Game Loop ---
    function update(time = 0) {
        if (isPaused) {
            return; // Stop the loop if paused
        }

        const deltaTime = time - lastTime;
        lastTime = time;
        dropCounter += deltaTime;

        if (dropCounter > dropInterval) {
            movePieceDown();
        }

        handleParticles();
        draw();
        gameLoop = requestAnimationFrame(update);
    }

    // --- Drawing ---
    function draw() {
        context.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();
        drawBoard();
        drawParticles();
        if (currentPiece) {
            drawGhostPiece(currentPiece);
            drawPiece(currentPiece);
        }
        if (isPaused) {
            drawPauseScreen();
        }
    }

    function drawGrid() {
        context.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        context.lineWidth = 1;
        for (let x = 0; x < COLS; x++) {
            context.beginPath();
            context.moveTo(x * BLOCK_SIZE, 0);
            context.lineTo(x * BLOCK_SIZE, canvas.height);
            context.stroke();
        }
        for (let y = 0; y < ROWS; y++) {
            context.beginPath();
            context.moveTo(0, y * BLOCK_SIZE);
            context.lineTo(canvas.width, y * BLOCK_SIZE);
            context.stroke();
        }
    }

    function drawBoard() {
        board.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value > 0) {
                    context.fillStyle = COLORS[value];
                    context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                }
            });
        });
    }

    function drawPiece(piece) {
        context.fillStyle = piece.color;
        piece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    context.fillRect(
                        (piece.x + x) * BLOCK_SIZE,
                        (piece.y + y) * BLOCK_SIZE,
                        BLOCK_SIZE,
                        BLOCK_SIZE
                    );
                }
            });
        });
    }

    function drawGhostPiece(piece) {
        const ghost = JSON.parse(JSON.stringify(piece)); // Deep clone
        ghost.color = 'rgba(255, 255, 255, 0.1)';

        while (!checkCollision(ghost)) {
            ghost.y++;
        }
        ghost.y--; // Move back to the last valid position

        drawPiece(ghost);
    }

    function drawPauseScreen() {
        context.fillStyle = 'rgba(0, 0, 0, 0.75)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = 'white';
        context.font = `bold ${BLOCK_SIZE * 1.5}px sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('Paused', canvas.width / 2, canvas.height / 2);
    }

    function drawParticles() {
        particles.forEach(p => p.draw(context));
    }

    // --- Particle Management ---
    function handleParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update();
            if (particles[i].life <= 0) {
                particles.splice(i, 1);
            }
        }
    }

    function createLineClearEffect(y, row) {
        for (let x = 0; x < COLS; x++) {
            const colorIndex = row[x] || 1;
            const color = COLORS[colorIndex];
            for (let i = 0; i < 10; i++) { // 10 particles per block
                particles.push(new Particle(
                    (x + 0.5) * BLOCK_SIZE,
                    (y + 0.5) * BLOCK_SIZE,
                    color
                ));
            }
        }
    }

    // --- Movement & Collision ---
    function movePieceDown() {
        currentPiece.y++;
        if (checkCollision(currentPiece)) {
            currentPiece.y--;
            lockPiece();
            spawnPiece();
        }
        dropCounter = 0;
        score += 1 // Increment score for each piece moved down
        updateScore();
    }

    function hardDrop() {
        while (!checkCollision(currentPiece)) {
            currentPiece.y++;
            score += 1
        }
        currentPiece.y--;
        lockPiece();
        spawnPiece();
        updateScore();
    }

    function movePieceLeft() {
        currentPiece.x--;
        if (checkCollision(currentPiece)) {
            currentPiece.x++;
        }
    }

    function movePieceRight() {
        currentPiece.x++;
        if (checkCollision(currentPiece)) {
            currentPiece.x--;
        }
    }

    function rotatePiece() {
        const originalShape = currentPiece.shape;
        const rotated = originalShape[0].map((_, colIndex) =>
            originalShape.map(row => row[colIndex]).reverse()
        );
        currentPiece.shape = rotated;

        let offset = 1;
        while (checkCollision(currentPiece)) {
            currentPiece.x += offset;
            offset = -(offset + (offset > 0 ? 1 : -1));
            if (offset > currentPiece.shape[0].length) {
                currentPiece.shape = originalShape;
                return;
            }
        }
    }

    function checkCollision(piece) {
        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[y].length; x++) {
                if (piece.shape[y][x]) {
                    let newX = piece.x + x;
                    let newY = piece.y + y;
                    if (newX < 0 || newX >= COLS || newY >= ROWS || (newY >= 0 && board[newY][newX])) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    // --- Game State ---
    function lockPiece() {
        currentPiece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    board[currentPiece.y + y][currentPiece.x + x] = COLORS.indexOf(currentPiece.color);
                }
            });
        });
        clearLines();
    }

    function clearLines() {
        let linesCleared = 0;
        outer: for (let y = ROWS - 1; y >= 0; y--) {
            if (board[y].every(value => value > 0)) {
                linesCleared++;
                const clearedRow = board.splice(y, 1)[0];
                createLineClearEffect(y, clearedRow);
                const newRow = Array(COLS).fill(0);
                board.unshift(newRow);
                y++;
            }
        }
        if (linesCleared > 0) {
            score += linesCleared * 10 * linesCleared;
            updateScore();
        }
    }

    function updateScore() {
        scoreElement.textContent = score
    }

    function togglePause() {
        isPaused = !isPaused;
        if (!isPaused) {
            gameLoop = requestAnimationFrame(update);
        } else {
            draw();
        }
    }

    function gameOver() {
        if (gameAreaDiv.classList.contains('hidden')) return // 防止多次触发
        cancelAnimationFrame(gameLoop);
        alert(`Game Over! Your score: ${score}`);
        gameAreaDiv.classList.add('hidden');
        settingsDiv.classList.remove('hidden');
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
    startButton.addEventListener('click', () => {
        startGame()
    });

    document.addEventListener('keydown', event => {
        if (event.key === 's' || event.key === 'S') {
            if(gameAreaDiv.classList.contains('hidden')) return;
            togglePause();
            return;
        }

        if (isPaused || !currentPiece) return;

        switch (event.key) {
            case 'ArrowLeft':
                movePieceLeft();
                break;
            case 'ArrowRight':
                movePieceRight();
                break;
            case 'ArrowDown':
                movePieceDown();
                break;
            case 'ArrowUp':
                rotatePiece();
                break;
            case ' ': // Space bar
                hardDrop();
                break;
        }
    });

    // 恢复正常下落速度
    document.addEventListener('keyup', event => {
        if (event.key === ' ') {
            if (isSpeedDrop) {
                dropInterval = dropIntervalBackup
                isSpeedDrop = false
            }
        }
    });

    // Mobile button listeners
    leftBtn.addEventListener('click', () => { if (!isPaused && currentPiece) movePieceLeft() })
    rightBtn.addEventListener('click', () => { if (!isPaused && currentPiece) movePieceRight() })
    downBtn.addEventListener('click', () => { if (!isPaused && currentPiece) movePieceDown() })
    rotateBtn.addEventListener('click', () => { if (!isPaused && currentPiece) rotatePiece() })
    // speedDropBtn.addEventListener('click', function(e) { if (!isPaused && currentPiece) hardDrop() })
    // pauseBtn.addEventListener('click', function(e) { togglePause() })
});
