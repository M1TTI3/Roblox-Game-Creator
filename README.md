# Prompt → Roblox Tycoon Builder

This project is now a **full-featured Tycoon package generator** focused on helping builders go from idea to an implementation-ready Roblox plan fast.

## What it generates

From one prompt, the app produces:

- Game architecture and progression loop
- Systems breakdown (ownership, income, purchases, rebirth, etc.)
- Object/folder structure map for Studio
- Multiple ready-to-copy server scripts (Luau)
- UI plan and monetization strategy
- QA checklist and step-by-step setup guide
- Downloadable package JSON + setup guide text

## Advanced generation controls

- Difficulty profile (beginner / standard / advanced)
- Session length balancing target
- Focus mode (economy / retention / monetization)
- Optional systems toggles (rebirth, workers, quests, gamepasses)
- Prompt preset chips for quick starts

## Run locally

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.

## Product boundaries

This still avoids direct Roblox Studio automation and publishing APIs. It is designed as a high-quality planning + script generation layer you can execute manually in Studio.
