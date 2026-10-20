---
title: "DeskDoze: let your notes find each other, then do one small thing"
published: false
tags: devchallenge, hf26challenge, opensource, ai
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 3: Slow and Steady](https://dev.to/challenges/hacktoberfest-week3-2026-10-19).*

## What I Built

A folder of loose notes can be a pile of decisions waiting to happen. Which notes belong together? What was I trying to do? Is cleaning the folder going to create more work than it saves?

DeskDoze gives those notes a gentle reset. It runs a small open-weight AI model locally, gathers related text files into suggested groups, and surfaces one explicit unfinished task per group. Every task points back to the file and line it came from.

The result is a quiet HTML report: a few groups, a few written next steps, and a preview of the file moves. Nothing moves until the plan is applied. The resulting journal can put the files back.

The scope is deliberately small: English text and Markdown notes, no accounts, no cloud inference, no background service to babysit.

## Demo

[Watch the 45-second demo and inspect its report](https://qais-ui.github.io/deskdoze/). This public page shows a recorded synthetic run; live analysis runs locally from the repository.

![DeskDoze report showing related notes and source-grounded next steps](https://qais-ui.github.io/deskdoze/report.png)

The demonstration uses seven synthetic notes named `note-01.md` through `note-07.md` (with some `.txt` files). Their filenames do not announce their topics. The real embedding model groups them into gardening, bicycle repair and soup preparation, leaving an unrelated astronomy note separate.

For the garden group, the suggested step is “- [ ] Water tomatoes.” It comes from line 3 of `note-01.md`. It is not a generated instruction. For the astronomy note, DeskDoze says it found no explicit next step.

The demo applies six moves, checks the contents, undoes the moves, and compares every original byte. An unsupported file stays untouched. The recording presents actual command results from the synthetic demo; it is not a recording of personal files.

## Code

[Source code, tests and reproducible demo on GitHub](https://github.com/qais-ui/deskdoze). The complete project is MIT-licensed. Run `npm ci`, then `npm run demo`. Once the model is cached, run `npm run demo -- --offline`.

## How I Built It

The AI core is [all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2), using [Xenova's ONNX conversion](https://huggingface.co/Xenova/all-MiniLM-L6-v2) through [Transformers.js](https://github.com/huggingface/transformers.js). These open components do the semantic work: converting each note's opening excerpt into a vector so related notes can find each other even when their filenames are unhelpful.

Complete-link clustering merges groups only when every cross-group pair exceeds the similarity threshold. That choice matters: a single bridge note should not drag two unrelated projects into one folder. Singleton notes are left in place. The group label comes from a representative source note, rather than a generated title.

I separated semantic grouping from task extraction. The model decides which notes seem related; ordinary code finds unchecked Markdown tasks and lines beginning with `TODO:` or `NEXT:`. It selects the shortest written task by word count. “Shortest” is not a claim that a task is quickest or most important, but it provides a simple place to start without fabricating an obligation.

The file-moving side is equally conservative. Plans store content hashes. Applying a plan checks for changed sources, occupied destinations and unsafe paths before moving anything. A write-ahead journal supports recovery if a run stops partway through. Undo refuses to overwrite a file that has been edited.

Tests exercise those failure cases, including an interrupted copy with both source and destination present. A separate integration demo exercises the actual model and the apply/undo round trip.

## Why Does Open Innovation Matter?

These notes do not need to become someone else's API request. After the initial model download, DeskDoze can analyze them locally using the cached weights. There is no per-note inference bill or API credential to maintain. Local computation still uses electricity and hardware; “no API bill” is not the same as zero resource cost.

The model, inference framework and application code can be inspected and changed. The clustering threshold is exposed. A different embedding model can be integrated without rebuilding the file-safety layer. Keeping inference local is a design benefit of this implementation; it is not a claim that every closed model requires cloud inference.

The limitations are visible too. The model sees only the opening excerpt of each note, and its tokenizer can truncate further. The current version does not read PDFs, images, Office files or nested folders. Semantic similarity can be wrong, especially outside the English-focused examples. That is why the output is a reviewable plan.

## The Lazy Payoff

On the synthetic example, seven loose notes become four reviewable groups, with three explicit next steps. The test run proves that the grouping and reversible movement work on that example. It does not prove how many minutes a person saves in everyday use; no user study has been run.

The intended payoff is fewer small decisions: open one report, choose one written task, and leave the rest for later. A tidy folder should not become another project to manage.

## Build Transparency

This new project was built during the challenge window. I selected the challenge and authorized the work; Codex generated the implementation, synthetic fixtures, tests and submission text. The demo uses actual local model inference and recorded verification results. No optional partner prize category is claimed, and no private agent transcript is published.
