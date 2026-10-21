---
title: "DeskDoze: tidy your notes, leave yourself one small task"
published: true
tags: devchallenge, hf26challenge, opensource, ai
---

*A submission for the [Hacktoberfest Open-Source AI Challenge, Week 3: Slow and Steady](https://dev.to/challenges/hacktoberfest-week3-2026-10-19).*

## What I Built

DeskDoze sorts loose text notes into related groups and picks out a task already written in each group. It runs on your computer and shows you the plan before moving a file.

The useful part is finding your way back into something. Two notes about a bicycle repair belong together. One says to find the pump; the other says to read the tyre size. DeskDoze brings them into one view, with a next step and its source line beside it.

If a note has no written task, it stays that way. If it has no close match, it stays separate. You can apply the proposed moves or leave the folder alone. Every applied plan has an undo journal.

## Demo

[Try the example and watch the 45-second demo](https://qais-ui.github.io/deskdoze/).

![DeskDoze showing related notes and a next step for each group](https://qais-ui.github.io/deskdoze/report.png?v=2)

The example starts with seven sample notes whose filenames give little away. The model finds three pairs: gardening, bicycle repair, and soup preparation. An astronomy note stays separate.

The gardening group shows **Water tomatoes**, taken from line 3 of `note-01.md`. The soup group shows **Rinse lentils**. Neither task was invented by a language model.

The demo also applies six moves, checks their contents, undoes them, and compares the restored files with the originals. All bytes match. An unsupported file is left alone. The video presents those recorded results.

## Code

[GitHub repository](https://github.com/qais-ui/deskdoze) · MIT license

```sh
npm ci
npm run demo
```

Open `demo/report.html`. Once the model is downloaded, the same demo runs with `npm run demo -- --offline`.

## How I Built It

The grouping uses [all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2), with [Xenova's ONNX weights](https://huggingface.co/Xenova/all-MiniLM-L6-v2) and [Transformers.js](https://github.com/huggingface/transformers.js). It embeds each note's opening excerpt, then compares the vectors by cosine similarity.

Every pair in a group must exceed the threshold. This avoids joining unrelated notes just because one note happens to connect them. Group names come from a representative note's heading; filenames are preserved.

Task extraction is simpler. It reads unchecked Markdown tasks and lines beginning with `TODO:` or `NEXT:`, then chooses the shortest by word count. The report includes the filename, line number, and original text. Shortest does not necessarily mean easiest, but it offers a clear place to start.

File moves use content hashes, checks for occupied destinations, and a journal written before the first move. Undo checks for edits before restoring anything. Tests cover changed files, path traversal, junctions, destination conflicts, and an interrupted move with both copies present.

## Why Does Open Innovation Matter?

Notes often contain things you would rather keep on your own machine. With downloadable weights and local inference, their contents can stay there. After setup, the cached model works offline, with no API key or per-request bill.

The grouping code and threshold are open too. You can inspect a questionable match, tighten the threshold, or integrate another embedding model. The model performs the semantic grouping; sorting these filenames by extension would not recover the three topics.

There are limits. This version reads top-level English `.txt` and `.md` files. Only the first 900 characters enter the embedding pipeline, and tokenization can shorten that further. Long or mixed-topic notes can be grouped badly. The review step matters.

## The Lazy Payoff

In the sample, seven loose notes become four groups and three written next steps. That gives you less to sort through before doing something useful.

There is no claim of hours saved: this is a tested prototype with synthetic examples, not a user study. Its job is small—gather the notes, show the next step, and let you get on with your day.

*Built and written with Codex. All demo notes are synthetic; verification results come from an actual local run.*
