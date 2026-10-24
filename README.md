# 遊戲記憶庫 · The Pixel Archive

A responsive Traditional Chinese retro RPG reference library. Static HTML, CSS, and JavaScript, with no dependencies, analytics, account system, or build process.

## Files

- `index.html`: accessible page structure, editorial copy, and screenshot dialog.
- `styles.css`: responsive cream-paper design with ink, vermilion, and olive accents.
- `app.js`: data loading, search, console filters, sorting, and screenshot lightbox.
- `games.json`: game catalogue maintained separately.
- `assets/`: locally stored, attributed game screenshots maintained separately.
- `.nojekyll`: allows direct static publishing with GitHub Pages.

## Run locally

Serve the directory with an HTTP server. Opening `index.html` directly with a `file:` URL may prevent the browser from fetching `games.json`.

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`.

## Game data

`games.json` must contain a non-empty JSON array. Each item accepts:

```json
{
  "id": "unique-game-id",
  "title": "原清單中的中文名稱",
  "original": "Original / 日本語 title",
  "platform": "SFC",
  "year": 1995,
  "genre": "角色扮演",
  "description": "Traditional Chinese description.",
  "image": "assets/game-id.png",
  "imageSource": "https://example.org/source-screenshot",
  "source": "https://example.org/game-reference",
  "note": "Optional version, title, or mapper correction."
}
```

Optional `imageAlt` is used for accessible image descriptions; `imageCaption` is shown in the lightbox and used as a screenshot tooltip. Source values can alternatively be objects with `url` and `label`. Screenshot locations may be relative paths or HTTP(S) URLs. Remote hotlinks can fail; prefer local image assets when rights and sourcing permit. The page does not substitute invented game imagery when an image is unavailable.

Recognized console names include FC, SFC, Game Boy Color/GBC, Mega Drive/MD, SEGA CD/Mega-CD, and Game Gear/GG. All categories and counts are derived from the actual data. Search matches all supplied game text. Multiple search terms must all match. Query, platform, and sort state are reflected in the URL, so filtered views can be bookmarked.

## Accessibility and interaction

- Semantic landmarks, a skip link, labelled inputs, and visible keyboard focus.
- Console filters use pressed states; result counts are announced politely.
- A native modal dialog traps focus and supports Escape, close button, backdrop dismissal, and left/right arrow navigation. Focus returns to the opening screenshot button.
- Press `/` to focus search when not typing or viewing a screenshot.
- Reduced-motion preference is respected.
- Images preserve source aspect ratio and use pixelated scaling.
- Source content is inserted as text, not executable HTML; links accept only HTTP(S).
- If data loading fails, a visible retry button is provided. Images fail gracefully and retain source links.

## Publication and rights

Publish the directory as-is to the authorized GitHub Pages repository. The deployment operator is responsible for selecting the repository branch/folder and verifying the published URL.

The original list's translated titles are retained alongside original titles and platform clarification. Release years primarily refer to original Japanese releases; read per-game notes for exceptions. Game names, characters, screenshots, and other materials remain the property of their respective rights holders. This project is for review, introduction, and reference only and provides no ROM downloads.
