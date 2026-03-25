# Virtual DOM Playground

Vanilla JavaScript demo for:

- DOM to Virtual DOM conversion
- Virtual DOM rendering
- Diff generation
- Patch application
- Undo / Redo history
- Keyed vs index-based diff comparison
- Inline diff visualization on the rendered DOM

## Folder Structure

```text
project-root/
├── index.html
├── package.json
├── src/
│   ├── app.js
│   ├── diff/
│   │   └── diff.js
│   ├── patch/
│   │   └── patch.js
│   ├── utils/
│   │   └── helpers.js
│   └── vdom/
│       ├── domToVdom.js
│       └── renderVdom.js
├── styles/
│   └── style.css
└── README.md
```

## Main Idea

The Actual area is the patch target.

The Test area is a rendered editing surface:

1. Read the sample DOM from the Actual area.
2. Convert it to an initial VDOM.
3. Render that VDOM into the editable Test area.
4. Edit the rendered preview directly.
5. Convert the edited preview DOM back into `previewVdom`.
6. Diff `actualVdom` and `previewVdom`.
7. Apply only the patches to the Actual DOM.

Existing keyed nodes keep `data-key` in the rendered preview, so they can still be tracked during editing.

## Main Modules

- `src/vdom/domToVdom.js`
  - Converts real DOM into VDOM.
- `src/vdom/renderVdom.js`
  - Renders VDOM into real DOM.
  - Mirrors `key` into `data-key` when needed so keyed patching can reuse DOM nodes.
- `src/diff/diff.js`
  - Builds patch lists from old and new VDOM.
  - Supports `Auto (Keyed)` and `Index Only`.
- `src/patch/patch.js`
  - Applies patches to the real DOM.
- `src/utils/helpers.js`
  - Key helpers, patch descriptions, VDOM stats, and tree formatting.
- `src/app.js`
  - Connects rendered editing, MutationObserver sync, patching, history, key inspector, and visualization.

## Supported Patch Types

- `CREATE`
- `REMOVE`
- `REPLACE`
- `TEXT`
- `PROPS`
- `REORDER`

## Diff Modes

### Auto (Keyed)

If sibling nodes have stable keys, diff compares them by identity first.

### Index Only

Ignores keyed reconciliation and compares siblings only by position.

This is useful for demonstrating why React-style keyed diff matters.

## UI Features

- Actual DOM area
- Test DOM preview area
- Rendered editing surface
- Notion-like block toolbar
- Patch log
- Key inspector
- Actual / Test VDOM tree panels
- Diff mode toggle
- Undo / Redo history
- Inline diff color cues and badges

## How To Edit

Edit the rendered Test DOM preview directly.

- Type to change text nodes.
- Use Backspace/Delete to remove nodes.
- Use Enter to create new lines or blocks depending on the current context.
- Use the block toolbar to insert paragraphs, headings, list items, keyed items, and prop changes.
- Existing keyed nodes keep their identity because the rendered DOM already contains `data-key`.
- New nodes created by plain typing are unkeyed unless the block tools assign a key.

## Block Toolbar

The mini toolbar above the Test area provides:

- `+ Text`
  - Insert a paragraph block after the selected block.
- `+ Heading`
  - Insert a heading block after the selected block.
- `+ Bullet`
  - Insert a list item.
- `+ Keyed Item`
  - Insert a list item with an auto-generated key.
- `Fill List`
  - Fill the current list with sample keyed items for a quick diff demo.
- `Key`
  - Assign an auto-generated key to the selected block.
- `Prop`
  - Toggle a visible prop (`data-tone="accent"`) on the selected block.
- `Duplicate`
  - Duplicate the selected block and regenerate any duplicated keys.
- `Delete`
  - Remove the selected block.

## MutationObserver

The rendered editor uses `MutationObserver` to detect DOM changes in the Test area.

That means:

- typing updates `previewVdom`
- toolbar actions update `previewVdom`
- structural DOM edits are reflected in the patch log and VDOM tree

## Recommended Demo Flow

1. Show the two DOM panels and the VDOM tree panels.
2. Change one text node directly in the preview.
   - Show a `TEXT` patch.
3. Remove the first keyed list item in the preview.
   - Show `REMOVE`.
   - Show that the remaining keyed nodes keep identity.
4. Use `+ Keyed Item`.
   - Show `CREATE`.
   - Show the new key badge.
5. Use `Prop` on a selected block.
   - Show `PROPS`.
6. Reorder two existing keyed children.
   - In `Auto (Keyed)`, show `REORDER`.
   - In `Index Only`, show heavier replacement behavior.
7. Use Undo / Redo.
   - Confirm that both DOM panels and the editor move through the same history.

## Good Talking Points

- Real DOM updates are expensive because they can trigger reflow and repaint.
- Virtual DOM lets us compare changes in memory before touching the real DOM.
- Keys preserve node identity across insert, remove, and reorder operations.
- MutationObserver is useful for detecting live DOM edits in the browser.
- React follows the same broad idea:
  - build the next virtual tree
  - reconcile old vs new
  - touch the real DOM only where needed

## Current Limits

- This is not React Fiber.
- No scheduler or concurrent rendering.
- Mixed keyed and unkeyed siblings still fall back to simpler behavior.
- Plain typing cannot invent stable keys by itself; the block tools are the safer way to create keyed nodes.

## Run

Open `index.html` directly in a browser, or run a static server:

```bash
python -m http.server 5500
```

Then open:

```text
http://127.0.0.1:5500
```
