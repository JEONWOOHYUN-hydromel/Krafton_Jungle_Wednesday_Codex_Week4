# Virtual DOM Diff Cases Demo

Vanilla JavaScript demo for:

- DOM -> Virtual DOM conversion
- Diff generation
- Patch application
- Undo / Redo history
- Inline visualization of changed DOM nodes
- Scenario-based demos for the 5 core diff cases

## What This Version Focuses On

The page is intentionally reduced to two panels only:

- `Actual DOM`
- `Test DOM`

The Test panel lets you load one diff case at a time:

1. `TEXT`
2. `PROPS`
3. `CREATE`
4. `REMOVE`
5. `REPLACE`

When you click a case, the right panel builds a new preview VDOM and shows the pending patch list.
When you click `Patch Actual`, only the changed nodes are applied to the left panel.

## UI Flow

### Actual DOM

- Shows the real DOM target
- Highlights patched nodes inline
- Shows a git-like `Actual Change Feed`
  - `+` for created content
  - `-` for removed content
  - `~` for updated props or reorder-style edits

### Test DOM

- Contains 5 scenario buttons
- Shows the selected case description
- Renders the preview DOM for that case
- Shows the pending patch list before patching

## Main Files

- `index.html`
  - Two-panel layout for Actual / Test
- `src/app.js`
  - Scenario logic, history, preview generation, patch flow, inline annotations
- `src/diff/diff.js`
  - Diff algorithm
- `src/patch/patch.js`
  - Patch application to the real DOM
- `src/vdom/domToVdom.js`
  - DOM -> VDOM conversion
- `src/vdom/renderVdom.js`
  - VDOM -> DOM rendering
- `src/utils/helpers.js`
  - Shared VDOM and diff helpers
- `styles/style.css`
  - Layout and diff visualization styles

## Recommended Demo Order

1. Click `1. TEXT`
   - Show one text-only change in the preview
2. Click `Patch Actual`
   - Show the text update on the left and the git-like change feed
3. Click `2. PROPS`
   - Show an attribute-only change
4. Click `3. CREATE`
   - Show a new keyed list item
5. Click `4. REMOVE`
   - Show one keyed item removed
6. Click `5. REPLACE`
   - Show one node type replaced with another
7. Use `Undo` / `Redo`
   - Show state history recovery

## Notes

- This demo is not React Fiber.
- It focuses on the core Virtual DOM / Diff / Patch idea.
- The 5-case Test panel is optimized for presentation rather than free-form editing.

## Run

Open `index.html` directly in a browser, or run a static server:

```bash
python -m http.server 5500
```

Then open:

```text
http://127.0.0.1:5500
```
