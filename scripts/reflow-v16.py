"""Place existing original answers in forward-only 10x7 scanword layouts."""
import json
import random
import sys
from pathlib import Path
from collections import defaultdict

import numpy as np
from scipy.optimize import milp, Bounds, LinearConstraint
from scipy.sparse import lil_matrix

ROOT = Path(__file__).resolve().parents[1]
source = json.loads((ROOT / 'data/puzzles.json').read_text())
out = []
for board in source:
    if len(sys.argv) > 1 and board['number'] != int(sys.argv[1]):
        out.append(board)
        continue
    rng = random.Random(1500 + board['number'])
    candidates = []
    by_word = defaultdict(list)
    clues = defaultdict(list)
    letters = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
    ends = defaultdict(list)
    for wi, word in enumerate(board['words']):
        length = len(word['answer'])
        for direction in ('across', 'down'):
            dr, dc = (0, 1) if direction == 'across' else (1, 0)
            for row in range(7):
                for col in range(10):
                    cr, cc = row - dr, col - dc
                    if cr < 0 or cc < 0 or row + dr * (length - 1) >= 7 or col + dc * (length - 1) >= 10:
                        continue
                    index = len(candidates)
                    candidates.append((wi, direction, row, col, cr, cc))
                    by_word[wi].append(index)
                    clues[(cr, cc)].append(index)
                    for k, letter in enumerate(word['answer']):
                        letters[(row + dr*k, col + dc*k)][direction][letter].append(index)
                    end = (row + dr*length, col + dc*length)
                    if 0 <= end[0] < 7 and 0 <= end[1] < 10:
                        ends[end].append(index)
    constraints = []
    candidate_count = len(candidates)
    crossing_cells = [(r, c) for r in range(7) for c in range(10)]
    def add(indices, upper=1, lower=-np.inf, coefficients=None):
        if indices:
            constraints.append((indices, coefficients or [1] * len(indices), lower, upper))
    for wi in range(len(board['words'])):
        add(by_word[wi], 1, 1)
    add([i for i, candidate in enumerate(candidates) if candidate[1] == 'down'], 6)
    for clue_row in range(7):
        add([i for i, candidate in enumerate(candidates) if candidate[4] == clue_row], 4)
    for crossing_number, cell in enumerate(crossing_cells):
        clue = clues[cell]
        groups = letters[cell]
        crossing_index = candidate_count + crossing_number
        all_letters = [v for axis in groups.values() for values in axis.values() for v in values]
        add(clue + all_letters) if not groups else None
        add(clue, 1)
        # A clue cannot coincide with any answer letter. A shared answer cell
        # is permitted only for one across and one down answer of same letter.
        for axis in ('across', 'down'):
            axis_indices = [v for values in groups[axis].values() for v in values]
            add(axis_indices, 1)
            add([crossing_index] + axis_indices, 0,
                coefficients=[1] + [-1] * len(axis_indices))
            # A word's run stops after its final letter. A different word
            # cannot put a letter directly after it, even on the other axis.
            add(ends[cell] + axis_indices, 1)
            for letter, entries in groups[axis].items():
                other_axis = 'down' if axis == 'across' else 'across'
                for other_letter, other_entries in groups[other_axis].items():
                    if letter != other_letter:
                        add(entries + other_entries, 1)
        for v in all_letters:
            add(clue + [v], 1)
    add(list(range(candidate_count, candidate_count + len(crossing_cells))),
        np.inf, 2)
    matrix = lil_matrix((len(constraints), candidate_count + len(crossing_cells)), dtype=np.float64)
    lows = np.empty(len(constraints)); highs = np.empty(len(constraints))
    for row, (indices, coefficients, low, high) in enumerate(constraints):
        matrix[row, indices] = coefficients
        lows[row] = low; highs[row] = high
    costs = np.array([rng.random()*.01 - .025 * (item[2] in (0, 6) or item[3] in (0, 9)) for item in candidates] + [0] * len(crossing_cells))
    result = milp(costs, integrality=np.ones(len(costs)), bounds=Bounds(0, 1),
                  constraints=LinearConstraint(matrix.tocsr(), lows, highs),
                  options={'time_limit': 45, 'mip_rel_gap': .1})
    if result.x is None:
        raise RuntimeError(f"No forward layout for board {board['number']}: {result.message}")
    chosen = [candidates[i] for i, x in enumerate(result.x[:candidate_count]) if x > .5]
    if len(chosen) != len(board['words']):
        raise RuntimeError('Incomplete layout')
    occupied = set()
    words = []
    for wi, direction, row, col, cr, cc in sorted(chosen):
        original = board['words'][wi]
        dr, dc = (0, 1) if direction == 'across' else (1, 0)
        words.append({**original, 'row':row, 'col':col, 'direction':direction,
                      'clueCell': {'row':cr, 'col':cc},
                      'arrow':'→' if direction == 'across' else '↓'})
        occupied.add((cr, cc))
        for k in range(len(original['answer'])):
            occupied.add((row + dr*k, col + dc*k))
    blocks = [{'row':r,'col':c} for r in range(7) for c in range(10) if (r,c) not in occupied]
    board['words'] = words
    board['blocks'] = blocks
    out.append(board)
    print(f"board {board['number']}: {len(blocks)} blocks, {sum(w['direction']=='down' for w in words)} down")
(ROOT / 'data/puzzles.json').write_text(json.dumps(out, ensure_ascii=False, indent=2)+'\n')
(ROOT / 'data/puzzles.js').write_text('window.SCANWORD_PUZZLES = '+json.dumps(out, ensure_ascii=False, separators=(',',':'))+';\n')
