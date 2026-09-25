"""Build fifty original, forward-only scanwords from a reviewed clue lexicon.

The stochastic layout is deterministic. A board is rejected unless every cell
is explicit (answer/clue/block), every run ends exactly, and at least two real
across/down crossings exist. Existing six boards are copied unchanged.
"""
import json
import random
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROWS, COLS = 7, 10
original = json.loads((ROOT / 'data/puzzles.json').read_text())[:6]
used_global = {w['answer'] for p in original for w in p['words']}
used_clues = {w['clue'] for p in original for w in p['words']}

lexicon = []
for line in (ROOT / 'data/v17-lexicon.txt').read_text().splitlines():
    if not line or line.startswith('#'):
        continue
    category, answer, clue, difficulty = line.split('|')
    if not (4 <= len(answer) <= 10 and len(clue) <= 32):
        continue
    lexicon.append(dict(category=category, answer=answer, clue=clue, difficulty=difficulty))
categories = list(dict.fromkeys(entry['category'] for entry in lexicon))
upgrades = {}
for line in (ROOT / 'data/v17-clue-upgrades.txt').read_text().splitlines():
    if line and not line.startswith('#'):
        answer, clue, difficulty = line.split('|')
        upgrades[answer] = clue, difficulty
for entry in json.loads((ROOT / 'data/words.json').read_text()):
    clue, difficulty = upgrades.get(entry['answer'], (entry['clue'], 'E'))
    if 4 <= len(entry['answer']) <= 10 and len(clue) <= 32:
        lexicon.append(dict(category='Общие знания', answer=entry['answer'], clue=clue, difficulty=difficulty))
# For duplicate answers the authored v17 clue takes priority.
lexicon = list({entry['answer']: entry for entry in reversed(lexicon)}.values())
for line in (ROOT / 'data/v17-tight-clues.txt').read_text().splitlines():
    if line and not line.startswith('#'):
        answer, clue = line.split('|')
        for entry in lexicon:
            if entry['answer'] == answer:
                entry['clue'] = clue
lexicon = [e for e in lexicon if e['answer'] not in used_global and e['clue'] not in used_clues]

def placement(entry, direction, row, col):
    dr, dc = ((0, 1) if direction == 'across' else (1, 0))
    cr, cc = row-dr, col-dc
    length = len(entry['answer'])
    if not (0 <= cr < ROWS and 0 <= cc < COLS and 0 <= row + dr*(length-1) < ROWS and 0 <= col + dc*(length-1) < COLS):
        return None
    cells = tuple((row+dr*i, col+dc*i, char) for i, char in enumerate(entry['answer']))
    return (direction, row, col, cr, cc, cells, (row+dr*length, col+dc*length))

def options(entry, state):
    grid, clues, ends = state
    seen = set()
    if grid:
        for (r, c), (letter, axis) in grid.items():
            if axis == 'both':
                continue
            for i, char in enumerate(entry['answer']):
                if char != letter:
                    continue
                direction = 'down' if axis == 'across' else 'across'
                row, col = ((r-i, c) if direction == 'down' else (r, c-i))
                key = direction, row, col
                if key in seen:
                    continue
                seen.add(key)
                candidate = placement(entry, *key)
                if candidate is not None:
                    yield candidate
    else:
        for direction in ('across', 'down'):
            for row in range(ROWS):
                for col in range(COLS):
                    candidate = placement(entry, direction, row, col)
                    if candidate is not None:
                        yield candidate

def valid(candidate, state):
    direction, row, col, cr, cc, cells, end = candidate
    grid, clues, ends = state
    if (cr, cc) in grid or (cr, cc) in clues or end in grid:
        return -1
    crossings = 0
    for r, c, char in cells:
        if (r, c) in clues or (r, c) in ends:
            return -1
        if (r, c) in grid:
            old_char, old_direction = grid[r, c]
            if old_char != char or old_direction in (direction, 'both'):
                return -1
            crossings += 1
    return crossings

def cell_clue(clue, answer):
    """Compact in-cell teaser; the complete clue remains in the clue bar."""
    if answer == 'ПАЛИТРА':
        return 'Краски в руке'
    if len(clue) <= 16:
        return clue
    piece = ''
    for word in clue.split():
        proposed = f'{piece} {word}'.strip()
        if len(proposed) > 16:
            break
        piece = proposed
    return piece + '…' if piece != clue else piece

def build(number, category, available, seed):
    rng = random.Random(seed)
    themed = [e for e in available if e['category'] == category]
    category_stock = Counter(e['category'] for e in available)
    future = Counter(categories[(n-7) % len(categories)] for n in range(number+1, 57))
    if len(themed) < 3:
        return None
    for attempt in range(400):
        grid, clues, ends = {}, set(), set()
        state = (grid, clues, ends)
        chosen = []
        theme_count = 0
        first = rng.choice([e for e in themed if 5 <= len(e['answer']) <= 9])
        first_positions = [p for p in options(first, state) if p[0] == 'across' and p[1] in (2,3,4) and p[2] in (1,2)]
        if not first_positions:
            continue
        p = rng.choice(first_positions)
        for index in range(8):
            if index == 0:
                entry, candidate, crosses = first, p, 0
            else:
                need_theme = theme_count < 3 and (index >= 4 or rng.random() < .58)
                pool = [e for e in available if e['answer'] not in {x[0]['answer'] for x in chosen}]
                spent = Counter(x[0]['category'] for x in chosen)
                if need_theme:
                    pool = [e for e in pool if e['category'] == category]
                pool = [e for e in pool if category_stock[e['category']] - spent[e['category']] > 3 * future[e['category']]]
                rng.shuffle(pool)
                pool = pool[:180]
                picks = []
                for word in pool:
                    for option in options(word, state):
                        count = valid(option, state)
                        if count < 1:
                            continue
                        new_cells = len(word['answer']) - count
                        if new_cells < 2:
                            continue
                        score = count*3 + min(new_cells, 7)*.2 + (word['category'] == category)*.2 + rng.random()*2
                        picks.append((score, word, option, count))
                if index >= 4 and (not picks or rng.random() < .35):
                    extras = []
                    for word in pool[:80]:
                        for _ in range(20):
                            direction = rng.choice(('across', 'down'))
                            option = placement(word, direction, rng.randrange(ROWS), rng.randrange(COLS))
                            if option is None:
                                continue
                            count = valid(option, state)
                            if count == 0:
                                extras.append((rng.random(), word, option, 0))
                    if extras and (not picks or rng.random() < .5):
                        picks = extras
                if not picks:
                    break
                picks.sort(key=lambda item: item[0], reverse=True)
                _, entry, candidate, crosses = rng.choice(picks[:min(24, len(picks))])
            direction, row, col, cr, cc, cells, end = candidate
            chosen.append((entry, candidate, crosses))
            theme_count += entry['category'] == category
            clues.add((cr, cc))
            if 0 <= end[0] < ROWS and 0 <= end[1] < COLS:
                ends.add(end)
            for r, c, char in cells:
                grid[(r, c)] = (char, direction if (r, c) not in grid else 'both')
            # A crossing with a twice-owned cell is unavailable to a third word.
        if len(chosen) == 8 and theme_count >= 3 and sum(x[2] for x in chosen) >= 2 and len(grid) >= 29:
            words = []
            for i, (entry, candidate, _) in enumerate(chosen, 1):
                direction, row, col, cr, cc, _, _ = candidate
                words.append(dict(id=f'w{i}', answer=entry['answer'], clue=entry['clue'], cellClue=cell_clue(entry['clue'], entry['answer']),
                                  topic=entry['category'], difficulty=entry['difficulty'], row=row, col=col,
                                  direction=direction, clueCell=dict(row=cr,col=cc), arrow='→' if direction == 'across' else '↓'))
            blocks = [dict(row=r,col=c) for r in range(ROWS) for c in range(COLS) if (r,c) not in grid and (r,c) not in clues]
            return dict(id=f'scanword-{number:03}',number=number,title=f'Сканворд №{number}',category=category,
                        source='original in-house definitions',rows=ROWS,cols=COLS,words=words,blocks=blocks), chosen
    return None

all_puzzles = original[:]
for number in range(7, 57):
    category = categories[(number-7) % len(categories)]
    available = [e for e in lexicon if e['answer'] not in used_global and e['clue'] not in used_clues]
    result = build(number, category, available, 17000+number)
    if result is None:
        raise RuntimeError(f'Cannot build board {number} ({category}), available {len(available)}, stock {Counter(e["category"] for e in available)}')
    puzzle, chosen = result
    all_puzzles.append(puzzle)
    for entry, _, _ in chosen:
        used_global.add(entry['answer'])
        used_clues.add(entry['clue'])
    print(number, category, len(puzzle['words']), len(puzzle['blocks']), sum(x[2] for x in chosen), flush=True)

(ROOT / 'data/puzzles.json').write_text(json.dumps(all_puzzles, ensure_ascii=False, indent=2)+'\n')
(ROOT / 'data/puzzles.js').write_text('window.SCANWORD_PUZZLES = '+json.dumps(all_puzzles, ensure_ascii=False, separators=(',',':'))+';\n')
print('Published',len(all_puzzles),'puzzles;',len(used_global),'unique answers')
