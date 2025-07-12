import curses
import random
import time

# Game constants
WIDTH = 20
HEIGHT = 40
SPEED = 0.5

# Tetromino shapes and colors
SHAPES = [
    [[1, 1, 1, 1]],  # I
    [[1, 1], [1, 1]],  # O
    [[0, 1, 0], [1, 1, 1]],  # T
    [[1, 1, 0], [0, 1, 1]],  # S
    [[0, 1, 1], [1, 1, 0]],  # Z
    [[1, 0, 0], [1, 1, 1]],  # J
    [[0, 0, 1], [1, 1, 1]],  # L
]

COLORS = [1, 2, 3, 4, 5, 6, 7]  # Corresponds to curses color pairs
GRID_COLOR_PAIR = 8

class Tetromino:
    def __init__(self, x, y, shape_id):
        self.x = x
        self.y = y
        self.shape_id = shape_id
        self.shape = SHAPES[shape_id]
        self.color = curses.color_pair(COLORS[shape_id])

def create_board():
    return [[0 for _ in range(WIDTH)] for _ in range(HEIGHT)]

def draw_board(stdscr, board, score):
    stdscr.clear()
    stdscr.addstr(0, 0, f"Score: {score}")

    # Draw border
    border_color = curses.color_pair(GRID_COLOR_PAIR)
    stdscr.attron(border_color)
    stdscr.addstr(1, 0, "┌" + "─" * (WIDTH * 2) + "┐")
    for y in range(HEIGHT):
        stdscr.addch(y + 2, 0, "│")
        # Draw grid lines
        for x in range(1, WIDTH):
            stdscr.addch(y + 2, x * 2, '·')
        stdscr.addch(y + 2, WIDTH * 2 + 1, "│")
    stdscr.addstr(HEIGHT + 2, 0, "└" + "─" * (WIDTH * 2) + "┘")
    stdscr.attroff(border_color)

    # Draw the board content (the fallen pieces)
    for y, row in enumerate(board):
        for x, cell in enumerate(row):
            if cell:
                stdscr.addch(y + 2, x * 2 + 1, '█', curses.color_pair(cell))
                stdscr.addch(y + 2, x * 2 + 2, '█', curses.color_pair(cell))


def draw_piece(stdscr, piece):
    for y, row in enumerate(piece.shape):
        for x, cell in enumerate(row):
            if cell:
                stdscr.addch(piece.y + y + 2, (piece.x + x) * 2 + 1, '█', piece.color)
                stdscr.addch(piece.y + y + 2, (piece.x + x) * 2 + 2, '█', piece.color)


def check_collision(board, piece):
    for y, row in enumerate(piece.shape):
        for x, cell in enumerate(row):
            if cell:
                board_y = piece.y + y
                board_x = piece.x + x
                if not (0 <= board_x < WIDTH and 0 <= board_y < HEIGHT and board[board_y][board_x] == 0):
                    return True
    return False

def merge_piece(board, piece):
    for y, row in enumerate(piece.shape):
        for x, cell in enumerate(row):
            if cell:
                board[piece.y + y][piece.x + x] = piece.shape_id + 1

def rotate_piece(piece, board):
    rotated_shape = list(zip(*piece.shape[::-1]))
    original_shape = piece.shape
    piece.shape = rotated_shape
    if check_collision(board, piece):
        piece.shape = original_shape # Revert if collision

def clear_lines(board):
    lines_cleared = 0
    new_board = [[0 for _ in range(WIDTH)] for _ in range(HEIGHT)]
    new_row_idx = HEIGHT - 1
    for y in range(HEIGHT - 1, -1, -1):
        if all(board[y]):
            lines_cleared += 1
        else:
            new_board[new_row_idx] = board[y]
            new_row_idx -= 1
    return new_board, lines_cleared

def main(stdscr):
    # Initialize curses
    curses.curs_set(0)
    stdscr.nodelay(1)
    stdscr.timeout(100)

    # Initialize colors
    curses.start_color()
    curses.use_default_colors()
    for i in range(len(COLORS)):
        curses.init_pair(i + 1, i + 1, -1)
    curses.init_pair(GRID_COLOR_PAIR, curses.COLOR_WHITE, -1)


    board = create_board()
    score = 0
    current_piece = Tetromino(WIDTH // 2 - 1, 0, random.randint(0, len(SHAPES) - 1))
    game_over = False
    last_fall_time = time.time()

    while not game_over:
        key = stdscr.getch()

        # Handle input
        if key == curses.KEY_LEFT:
            current_piece.x -= 1
            if check_collision(board, current_piece):
                current_piece.x += 1
        elif key == curses.KEY_RIGHT:
            current_piece.x += 1
            if check_collision(board, current_piece):
                current_piece.x -= 1
        elif key == curses.KEY_DOWN:
            current_piece.y += 1
            if check_collision(board, current_piece):
                current_piece.y -= 1
        elif key == curses.KEY_UP:
            rotate_piece(current_piece, board)
        elif key == ord('q'):
            break

        # Game logic
        if time.time() - last_fall_time > SPEED:
            current_piece.y += 1
            if check_collision(board, current_piece):
                current_piece.y -= 1
                merge_piece(board, current_piece)
                board, lines_cleared = clear_lines(board)
                score += lines_cleared * 10
                current_piece = Tetromino(WIDTH // 2 - 1, 0, random.randint(0, len(SHAPES) - 1))
                if check_collision(board, current_piece):
                    game_over = True
            last_fall_time = time.time()

        # Drawing
        draw_board(stdscr, board, score)
        draw_piece(stdscr, current_piece)
        stdscr.refresh()


    stdscr.nodelay(0)
    stdscr.addstr(HEIGHT // 2, (WIDTH * 2 - 10) // 2, "Game Over!")
    stdscr.addstr(HEIGHT // 2 + 1, (WIDTH * 2 - 13) // 2, f"Final Score: {score}")
    stdscr.refresh()
    time.sleep(3)


if __name__ == "__main__":
    curses.wrapper(main)
