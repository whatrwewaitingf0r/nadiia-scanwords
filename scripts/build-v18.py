"""Build 56 original, forward-only scanwords without accidental letter edges.

The stochastic layout is deterministic. A board is rejected unless every cell
is explicit (answer/clue/block), every run ends exactly, and at least two real
across/down crossings exist. The original six retain their clue pool.
"""
import json
import random
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROWS, COLS = 7, 10
original = json.loads((ROOT / 'data/v16-first-six.json').read_text())
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
    grid, clues, ends, edges = state
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
    grid, clues, ends, edges = state
    if (cr, cc) in grid or (cr, cc) in clues or end in grid:
        return -1
    crossings = 0
    candidate_cells = {(r, c) for r, c, _ in cells}
    candidate_edges = {frozenset((a, b)) for a, b in zip(
        [(r, c) for r, c, _ in cells], [(r, c) for r, c, _ in cells][1:])}
    for r, c, char in cells:
        if (r, c) in clues or (r, c) in ends:
            return -1
        if (r, c) in grid:
            old_char, old_direction = grid[r, c]
            if old_char != char or old_direction in (direction, 'both'):
                return -1
            crossings += 1
        for neighbor in ((r-1,c), (r+1,c), (r,c-1), (r,c+1)):
            if neighbor in grid or neighbor in candidate_cells:
                if frozenset(((r,c), neighbor)) not in edges and frozenset(((r,c), neighbor)) not in candidate_edges:
                    return -1
    return crossings

def cell_clue(clue, answer):
    """Compact in-cell teaser; the complete clue remains in the clue bar."""
    if answer == 'ПАЛИТРА':
        return 'Краски в руке'
    if answer == 'ПЛАВНИК':
        return 'Для плавания'
    if len(clue) <= 16:
        return clue
    piece = ''
    for word in clue.split():
        proposed = f'{piece} {word}'.strip()
        if len(proposed) > 16:
            break
        piece = proposed
    return piece + '…' if piece != clue else piece

def build(number, category, available, seed, required=(), target=8, min_theme=3):
    rng = random.Random(seed)
    themed = [e for e in available if e['category'] == category]
    category_stock = Counter(e['category'] for e in available)
    future = Counter(categories[(n-7) % len(categories)] for n in range(number+1, 57))
    if len(themed) < min_theme:
        return None
    for attempt in range(900):
        grid, clues, ends, edges = {}, set(), set(), set()
        state = (grid, clues, ends, edges)
        chosen = []
        theme_count = 0
        first_pool = [e for e in themed if 5 <= len(e['answer']) <= 9]
        if required:
            first_pool = [e for e in first_pool if e['answer'] in required] or first_pool
        first = rng.choice(first_pool)
        first_positions = [p for p in options(first, state) if p[0] == 'across' and p[1] in (2,3,4) and p[2] in (1,2)]
        if not first_positions:
            continue
        p = rng.choice(first_positions)
        for index in range(target):
            if index == 0:
                entry, candidate, crosses = first, p, 0
            else:
                theme_deadline = 4 if number <= 50 else target-4
                need_theme = theme_count < min_theme and (index >= theme_deadline or rng.random() < .58)
                pool = [e for e in available if e['answer'] not in {x[0]['answer'] for x in chosen}]
                spent = Counter(x[0]['category'] for x in chosen)
                if need_theme:
                    pool = [e for e in pool if e['category'] == category]
                if number > 6:
                    pool = [e for e in pool if category_stock[e['category']] - spent[e['category']] > 3 * future[e['category']]]
                missing = set(required) - {x[0]['answer'] for x in chosen}
                if missing and index >= 4:
                    pool = [e for e in pool if e['answer'] in missing]
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
            sequence = [(r,c) for r,c,_ in cells]
            edges.update(frozenset((a,b)) for a,b in zip(sequence, sequence[1:]))
            # A crossing with a twice-owned cell is unavailable to a third word.
        if len(chosen) == target and theme_count >= min_theme and sum(x[2] for x in chosen) >= 2 and len(grid) >= 3*target+5 and set(required) <= {x[0]['answer'] for x in chosen}:
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

def main():
    checkpoint = ROOT / 'output/v18-checkpoint.json'
    all_puzzles = json.loads(checkpoint.read_text()) if checkpoint.exists() else []
    if all_puzzles:
        used_global.update(w['answer'] for p in all_puzzles for w in p['words'])
        used_clues.update(w['clue'] for p in all_puzzles for w in p['words'])
    for source in original[len(all_puzzles):]:
        number, category = source['number'], source['category']
        available = [dict(answer=w['answer'], clue=w['clue'], category=category,
                          difficulty=w.get('difficulty', 'M')) for w in source['words']]
        required = ('ФОНАРЬ', 'СИНИЦА') if number == 1 else ('МЫЛО', 'ЧАША') if number == 5 else ()
        result = build(number, category, available, 18000+number, required)
        if result is None:
            raise RuntimeError(f'Cannot repair original board {number}')
        puzzle, _ = result
        all_puzzles.append(puzzle)
        checkpoint.write_text(json.dumps(all_puzzles,ensure_ascii=False))
        print(number, category, len(puzzle['words']), len(puzzle['blocks']), flush=True)
    for number in range(7, 57):
        if number <= len(all_puzzles):
            continue
        category = categories[(number-7) % len(categories)]
        available = [e for e in lexicon if e['answer'] not in used_global and e['clue'] not in used_clues]
        if number >= 55:
            actual_answers = {w['answer'] for p in all_puzzles for w in p['words']}
            actual_clues = {w['clue'] for p in all_puzzles for w in p['words']}
            available.extend(dict(answer=w['answer'], clue=w['clue'], category='Общие знания',
                                  difficulty=w.get('difficulty','M'))
                             for p in original for w in p['words']
                             if w['answer'] not in actual_answers and w['clue'] not in actual_clues)
        result = None
        variants = ((6,3),(6,2),(5,2),(5,1)) if number >= 48 else ((7,3),)
        for target, min_theme in variants:
            for retry in range(12):
                result = build(number, category, available, 17000+number+retry*1000,
                               target=target, min_theme=min_theme)
                if result is not None:
                    break
            if result is not None:
                break
        if result is None:
            raise RuntimeError(f'Cannot build board {number} ({category}), available {len(available)}, stock {Counter(e["category"] for e in available)}')
        puzzle, chosen = result
        all_puzzles.append(puzzle)
        for entry, _, _ in chosen:
            used_global.add(entry['answer'])
            used_clues.add(entry['clue'])
        print(number, category, len(puzzle['words']), len(puzzle['blocks']), sum(x[2] for x in chosen), flush=True)
        checkpoint.write_text(json.dumps(all_puzzles,ensure_ascii=False))

    (ROOT / 'data/puzzles.json').write_text(json.dumps(all_puzzles, ensure_ascii=False, indent=2)+'\n')
    (ROOT / 'data/puzzles.js').write_text('window.SCANWORD_PUZZLES = '+json.dumps(all_puzzles, ensure_ascii=False, separators=(',',':'))+';\n')
    print('Published',len(all_puzzles),'puzzles;',len(used_global),'unique answers')

if __name__ == "__main__":
    main()
