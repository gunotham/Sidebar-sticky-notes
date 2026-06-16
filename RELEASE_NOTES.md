# Sticky Notes Sidebar — v1.1

Two big additions in this release: a search box for finding notes fast, and a real Settings panel that lets your notes follow your Firefox theme.

## What's New

### 🔍 Search your notes
A new search bar lets you filter the notes list instantly as you type. No more scrolling to find that one snippet — just start typing and the list narrows down to matching notes.

### 🎨 Theme settings & browser theme matching
A new Settings dialog (gear icon) gives you full control over how the panel looks. Pick from four theme modes:

- **System** — follows your OS light/dark preference (default).
- **Light** — always light.
- **Dark** — always dark.
- **Browser** — pulls colors straight from your installed Firefox theme, so the sidebar blends in with the rest of your browser. Colors the theme doesn't define fall back to the built-in palette, and the option is disabled automatically if your current theme exposes no colors.

The first time a usable browser theme is detected, a one-time prompt offers to match it. Your choice is remembered.

## Existing Features
- Persistent notes saved locally between sessions
- Resizable notes list
- Rename (✎) and delete (×, with confirmation) notes
- Clean, minimal interface
- No data collection — everything stays on your machine

## Notes
- Firefox only (uses the sidebar API).
- Permissions unchanged: `storage` only.
