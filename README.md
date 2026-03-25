# Virtual DOM Playground

Vanilla JavaScript project that demonstrates:

- DOM to Virtual DOM conversion
- Virtual DOM rendering
- Diff generation
- Patch application
- Undo / Redo history
- Keyed vs index-based diff comparison
- VDOM tree visualization

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

## Main Modules

- `src/vdom/domToVdom.js`
  - Converts DOM or HTML strings into a VDOM tree.
- `src/vdom/renderVdom.js`
  - Renders a VDOM tree back into real DOM nodes.
- `src/diff/diff.js`
  - Builds patch lists from old and new VDOM.
  - Supports `Auto (Keyed)` and `Index Only` modes.
- `src/patch/patch.js`
  - Applies patches to the real DOM.
  - Returns changed elements so the UI can highlight them.
- `src/app.js`
  - Connects the full demo flow, history, patch log, diff mode toggle, and VDOM tree panels.
- `src/utils/helpers.js`
  - Shared helpers for keys, patch descriptions, VDOM stats, and tree formatting.

## Supported Patch Types

- `CREATE`
- `REMOVE`
- `REPLACE`
- `TEXT`
- `PROPS`
- `REORDER`

## Diff Modes

### Auto (Keyed)

If all sibling nodes in the same list have `key` or `data-key`, the diff uses key-based comparison.

Example:

```html
<ul>
  <li data-key="dom">DOM to VDOM</li>
  <li data-key="diff">Keyed reconciliation</li>
  <li data-key="patch">Selective DOM update</li>
</ul>
```

Reordering those items produces a `REORDER` patch instead of replacing every item.

### Index Only

Disables keyed comparison and compares siblings only by index.  
This is useful for demonstrating why React-style keyed reconciliation matters.

## UI Features

- Two live areas:
  - Actual DOM
  - Test DOM
- HTML editor for direct manual changes
- `Patch`, `Undo`, `Redo`
- Diff mode toggle:
  - `Auto (Keyed)`
  - `Index Only`
- Patch log panel
- Actual VDOM tree panel
- Test VDOM tree panel
- Changed node highlight animation after patch

## How It Works

1. On page load, the sample DOM inside the Actual DOM area is converted into Virtual DOM.
2. The same VDOM is rendered into the Test DOM preview and HTML editor.
3. While editing HTML:
   - the Test DOM preview updates
   - the patch log updates
   - the Test VDOM tree updates
4. When `Patch` is clicked:
   - current editor HTML becomes the next VDOM
   - diff is generated against the current Actual VDOM
   - only the patches are applied to the Actual DOM
   - changed nodes are highlighted
   - the new VDOM is stored in history
5. `Undo` and `Redo` restore both Actual DOM and Test DOM from saved VDOM snapshots.

## Run

### Open directly

Open `index.html` in a browser.

### Or run a local static server

```bash
python -m http.server 5500
```

Then open:

```text
http://127.0.0.1:5500
```

## Recommended Demo Flow

This order works well for a presentation or assignment demo.

1. Show the layout
   - Left: Actual DOM
   - Right: editable Test DOM
   - Bottom: patch log and VDOM tree panels
2. Change one sentence
   - Show a simple `TEXT` patch.
   - Point out the highlighted changed node.
3. Change one attribute
   - Example: `data-version="v3"` to `data-version="v4"`
   - Show a `PROPS` patch.
4. Reorder the keyed list in `Auto (Keyed)` mode
   - Move the `li[data-key="patch"]` item to the top.
   - Show that the patch log produces `REORDER`.
   - Show that the Test VDOM tree order changed.
5. Switch to `Index Only`
   - Keep the same reordered HTML.
   - Show that the patch log changes from `REORDER` to multiple `REPLACE` patches.
   - This is the clearest visual explanation of why keys matter.
6. Add or remove a keyed item
   - Example: add `<li data-key="extra">Extra node</li>`
   - Show how keyed list changes are represented.
7. Add a plain paragraph at the bottom
   - Show a regular `CREATE` patch.
   - Delete it again to show `REMOVE`.
8. Use `Undo` and `Redo`
   - Confirm that both DOM panels and the editor move through state history together.

## Good Talking Points

- Real DOM updates are expensive because they can trigger reflow and repaint.
- Virtual DOM allows comparison in memory before touching the real DOM.
- Keys matter because they preserve node identity during reorder operations.
- React uses the same broad idea:
  - create the next virtual tree
  - reconcile differences
  - minimize real DOM work

## Current Limits

- This is not React Fiber.
- No scheduler or concurrent rendering.
- Mixed keyed and unkeyed siblings still fall back to simpler behavior.
- It is a learning/demo implementation, not a production renderer.

## Next Ideas

- Store patch logs per history entry
- Add a benchmark mode with long lists
- Add MutationObserver experiments
- Add a side-by-side "full rerender vs patch" performance comparison
