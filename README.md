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

This demo now uses the Virtual DOM itself as the editable source.

Flow:

1. Read the sample DOM from the Actual area.
2. Convert it to an initial VDOM.
3. Show that VDOM as editable JSON.
4. Render the edited VDOM into the Test area.
5. Diff `actualVdom` and `previewVdom`.
6. Apply only the patches to the Actual DOM.

Because the source is now VDOM JSON, keys stay in the virtual tree and are easier to preserve than when editing raw HTML.

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
  - Key helpers, patch descriptions, VDOM formatting, and VDOM JSON normalization.
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
- VDOM JSON editor
- Patch log
- Key inspector
- Actual / Test VDOM tree panels
- Diff mode toggle
- Undo / Redo history
- Inline diff color cues and badges

## How To Edit

The editor expects VDOM JSON.

- Root node:

```json
{
  "type": "ROOT",
  "children": []
}
```

- Text node:

```json
{
  "type": "TEXT",
  "value": "Hello"
}
```

- Element node:

```json
{
  "type": "ELEMENT",
  "tagName": "li",
  "key": "item-2",
  "props": {
    "class": "feature-item"
  },
  "children": [
    {
      "type": "TEXT",
      "value": "Second item"
    }
  ]
}
```

Notes:

- `key` is edited directly in VDOM JSON.
- Internally the renderer mirrors that key to `data-key` for DOM reuse.
- If the JSON is invalid, preview stays on the last valid VDOM and `Patch` is disabled.

## Recommended Demo Flow

1. Show the initial VDOM JSON editor and the two DOM panels.
2. Change one text node value.
   - Show a `TEXT` patch.
3. Change one prop value in `props`.
   - Show a `PROPS` patch.
4. Add a new keyed child object at the top of a keyed list.
   - Show `CREATE`.
   - Show that existing keyed nodes remain preserved.
5. Remove the first keyed child.
   - Show `REMOVE`.
   - Show that the remaining keyed nodes keep identity.
6. Reorder two existing keyed children.
   - In `Auto (Keyed)`, show `REORDER`.
   - In `Index Only`, show heavier replacement behavior.
7. Use Undo / Redo.
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
- The VDOM editor is JSON-based, not a full tree UI.

## Run

Open `index.html` directly in a browser, or run a static server:

```bash
python -m http.server 5500
```

Then open:

```text
http://127.0.0.1:5500
```
