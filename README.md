# Virtual DOM Playground

Vanilla JavaScript project for demonstrating:

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

This demo now uses the rendered preview DOM as the editing surface while keeping Virtual DOM as the state used for diffing and patching.

Flow:

1. Read the sample DOM from the Actual area.
2. Convert it to an initial VDOM.
3. Render that VDOM into the Test area.
4. Edit the rendered preview directly.
5. Convert the edited preview DOM back into `previewVdom`.
6. Diff `actualVdom` and `previewVdom`.
7. Apply only the patches to the Actual DOM.

Because the preview is rendered from VDOM first, existing keyed nodes keep their `data-key` in the DOM and can still be tracked during normal editing.

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
  - Key helpers, patch descriptions, and VDOM formatting.
- `src/app.js`
  - Connects editor input, preview rendering, patching, history, key inspector, and visualization.

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

Example VDOM child:

```json
{
  "type": "ELEMENT",
  "tagName": "li",
  "key": "patch",
  "children": [
    {
      "type": "TEXT",
      "value": "Selective DOM update"
    }
  ]
}
```

### Index Only

Ignores keyed reconciliation and compares siblings only by position.

This is useful for showing why React-style keyed diff exists.

## UI Features

- Actual DOM area
- Test DOM preview area
- Rendered editing surface
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
- Use Enter to create new lines or elements depending on the current context.
- Existing keyed nodes keep their identity because the rendered DOM already contains `data-key`.
- New nodes created directly in the editor start unkeyed unless they come from an already keyed VDOM node.

## Recommended Demo Flow

1. Show the two DOM panels and the VDOM tree panels.
2. Change one text node value directly in the preview.
   - Show a `TEXT` patch.
3. Remove the first keyed list item in the preview.
   - Show `REMOVE`.
   - Show that the remaining keyed nodes keep identity.
4. Add a new paragraph or line in the preview.
   - Show `CREATE`.
5. Reorder two existing keyed children.
   - In `Auto (Keyed)`, show `REORDER`.
   - In `Index Only`, show heavier replacement behavior.
6. Use Undo / Redo.
   - Confirm that both DOM panels and the editor move through the same history.

## Good Talking Points

- Real DOM updates are expensive because they can trigger reflow and repaint.
- Virtual DOM lets us compare changes in memory first.
- Keys preserve node identity across insert, remove, and reorder operations.
- React follows the same broad idea:
  - build the next virtual tree
  - reconcile old vs new
  - touch the real DOM only where needed

## Current Limits

- This is not React Fiber.
- No scheduler or concurrent rendering.
- Mixed keyed and unkeyed siblings still fall back to simpler behavior.
- Editing attributes like `key` directly is less convenient than in the earlier JSON editor.

## Run

Open `index.html` directly in a browser, or run a static server:

```bash
python -m http.server 5500
```

Then open:

```text
http://127.0.0.1:5500
```
