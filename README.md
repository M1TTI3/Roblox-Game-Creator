# Prompt → Roblox Tycoon Builder (MVP)

This repository contains a simple front-end MVP for generating a **Tycoon/Simulator-focused Roblox game package** from one prompt.

## What it does

- Takes one prompt (e.g. "pizza tycoon with workers and VIP gamepass")
- Shows generation progress states
- Outputs:
  - Game overview
  - Systems list
  - Ready-to-copy Luau scripts
  - UI plan
  - Step-by-step setup guide for Roblox Studio

## Run locally

Because this is static HTML/CSS/JS, you can run it with any static server, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Current scope

This MVP intentionally does **not** include:

- automatic Roblox publishing
- direct Roblox Studio integration
- drag-and-drop map/model generation
- multiplayer synchronization complexity
