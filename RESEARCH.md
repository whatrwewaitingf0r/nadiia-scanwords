# Research notes: supportive scanword UX

This project is a recreational word-puzzle interface for Nadiia's mother. It is **not medical software**, does not diagnose or treat aphasia or stroke, and makes no clinical-benefit claim. Clinical exercises should be selected with a speech-language professional when appropriate.

## Practices translated into the interface

- **Readable, aphasia-friendly presentation.** ASHA describes accommodations such as large print, pictures, and aphasia-friendly formatting. The National Aphasia Association similarly recommends short clear messages, extra response time, reduced distraction, and visual/written supports. The app therefore uses large high-contrast cells, one focused word, a single full-width clue, and a quiet layout.
- **Cueing without punishment.** ASHA lists semantic and phonological word-retrieval cues. Here, hints can reveal one letter, add more tiles, or reveal the word. They do not reduce a score.
- **Attempts are allowed.** A 2023 scoping review found that errorless, errorful, and retrieval-practice approaches use different mechanisms and that comparative evidence and individual response remain mixed. The interface does not flash red after each letter; it checks only a completed word and keeps incorrect letters editable.
- **Short sessions and return later.** Distributed-practice research in aphasia naming is promising but still calls for better-controlled clinical evidence. This app makes the practical, non-clinical choice to offer short grids and save progress locally so a person can stop at any time.
- **Concrete before abstract.** Easier categories favor imageable nouns; harder modes can use abstract terms. This is a content-design heuristic, not a treatment protocol.

## Sources

1. American Speech-Language-Hearing Association, *Aphasia — Practice Portal*: https://www.asha.org/practice-portal/clinical-topics/aphasia/
2. National Aphasia Association, *Communication Supports*: https://aphasia.org/communication-supports/
3. Nunn, Vallila-Rohter & Middleton (2023), *Errorless, Errorful, and Retrieval Practice for Naming Treatment in Aphasia: A Scoping Review*: https://pubmed.ncbi.nlm.nih.gov/36729701/
4. Middleton, Schuchard & Rawson (2020), *A Review of the Application of Distributed Practice Principles to Naming Treatment in Aphasia*: https://pubmed.ncbi.nlm.nih.gov/32831450/

## Content provenance

All clues and word lists in this repository were written for this project. No commercial scanword pack, artwork, icon set, branding, pencil mark, or MBEX content was copied or scraped.
