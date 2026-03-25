import { DIFF_MODES, diff } from "./diff/diff.js";
import { applyPatches } from "./patch/patch.js";
import {
  cloneVdom,
  describePatch,
  escapeHtml,
  getVdomStats,
  rootToHtml,
  summarizePatches,
  vdomToTreeString,
} from "./utils/helpers.js";
import { domChildrenToVdom, htmlToVdom } from "./vdom/domToVdom.js";
import { mountVdom } from "./vdom/renderVdom.js";

const DIFF_MODE_LABELS = {
  [DIFF_MODES.AUTO]: "Auto (Keyed)",
  [DIFF_MODES.INDEX]: "Index Only",
};

const DEFAULT_LOG_MESSAGE = "Edit the HTML to preview diff or click Patch to apply it.";

const elements = {
  actualRoot: document.querySelector("#actual-root"),
  testRoot: document.querySelector("#test-root"),
  editor: document.querySelector("#test-editor"),
  patchButton: document.querySelector("#patch-button"),
  undoButton: document.querySelector("#undo-button"),
  redoButton: document.querySelector("#redo-button"),
  historyStatus: document.querySelector("#history-status"),
  diffModeStatus: document.querySelector("#diff-mode-status"),
  patchCount: document.querySelector("#patch-count"),
  patchStatus: document.querySelector("#patch-status"),
  patchLog: document.querySelector("#patch-log"),
  diffModeButtons: Array.from(document.querySelectorAll("[data-diff-mode]")),
  actualTree: document.querySelector("#actual-vdom-tree"),
  previewTree: document.querySelector("#preview-vdom-tree"),
  actualTreeSummary: document.querySelector("#actual-vdom-summary"),
  previewTreeSummary: document.querySelector("#preview-vdom-summary"),
};

const state = {
  history: [],
  index: 0,
  lastPatches: [],
  actualVdom: null,
  previewVdom: null,
  diffMode: DIFF_MODES.AUTO,
  statusMessage: "Initial Virtual DOM is ready.",
  highlightTimer: null,
};

bootstrap();

function bootstrap() {
  const initialVdom = domChildrenToVdom(elements.actualRoot);

  mountVdom(elements.actualRoot, initialVdom);
  mountVdom(elements.testRoot, initialVdom);

  state.history = [cloneVdom(initialVdom)];
  state.index = 0;
  state.lastPatches = [];
  state.actualVdom = cloneVdom(initialVdom);
  state.previewVdom = cloneVdom(initialVdom);
  state.statusMessage = "Initial Virtual DOM is ready.";

  syncEditor(initialVdom);
  bindEvents();
  renderModeButtons();
  renderVdomTrees();
  renderPatchLog(DEFAULT_LOG_MESSAGE);
  renderToolbarMeta();
}

function bindEvents() {
  elements.patchButton.addEventListener("click", handlePatch);
  elements.undoButton.addEventListener("click", handleUndo);
  elements.redoButton.addEventListener("click", handleRedo);
  elements.editor.addEventListener("input", handleEditorInput);

  elements.diffModeButtons.forEach((button) => {
    button.addEventListener("click", handleDiffModeChange);
  });
}

function handleEditorInput() {
  const nextVdom = htmlToVdom(elements.editor.value);

  state.previewVdom = cloneVdom(nextVdom);
  mountVdom(elements.testRoot, nextVdom);
  renderVdomTrees();
  refreshPreviewDiff("The current actual and test VDOM match in this mode.");
}

function handlePatch() {
  const nextVdom = htmlToVdom(elements.editor.value);
  const patches = diff(state.actualVdom, nextVdom, { mode: state.diffMode });

  state.previewVdom = cloneVdom(nextVdom);
  state.lastPatches = patches;
  mountVdom(elements.testRoot, nextVdom);
  renderVdomTrees();
  renderPatchLog("No changes to apply.");

  if (patches.length === 0) {
    state.statusMessage = "No changes to apply.";
    renderToolbarMeta();
    return;
  }

  const changedElements = applyPatches(elements.actualRoot, patches);

  flashPatchedElements(changedElements);
  pushHistory(nextVdom);

  state.actualVdom = cloneVdom(nextVdom);
  state.previewVdom = cloneVdom(nextVdom);
  state.statusMessage = `Patch applied with ${DIFF_MODE_LABELS[state.diffMode]}: ${summarizePatches(patches)}`;

  syncEditor(nextVdom);
  renderVdomTrees();
  renderToolbarMeta();
}

function handleUndo() {
  if (state.index === 0) {
    return;
  }

  state.index -= 1;
  applyHistorySnapshot("Undo completed.");
}

function handleRedo() {
  if (state.index >= state.history.length - 1) {
    return;
  }

  state.index += 1;
  applyHistorySnapshot("Redo completed.");
}

function handleDiffModeChange(event) {
  const nextMode = event.currentTarget.dataset.diffMode;

  if (!nextMode || nextMode === state.diffMode) {
    return;
  }

  state.diffMode = nextMode;
  state.statusMessage = `Diff mode changed to ${DIFF_MODE_LABELS[nextMode]}.`;

  renderModeButtons();
  refreshPreviewDiff("The current actual and test VDOM match in this mode.");
  renderToolbarMeta();
}

function applyHistorySnapshot(message) {
  const snapshot = cloneVdom(state.history[state.index]);

  state.actualVdom = cloneVdom(snapshot);
  state.previewVdom = cloneVdom(snapshot);
  state.lastPatches = [];
  state.statusMessage = message;

  mountVdom(elements.actualRoot, snapshot);
  mountVdom(elements.testRoot, snapshot);
  syncEditor(snapshot);
  clearPatchedElements();
  renderVdomTrees();
  renderPatchLog(`${message} Actual and test VDOM are synced again.`);
  renderToolbarMeta();
}

function pushHistory(vdom) {
  const safeSnapshot = cloneVdom(vdom);

  state.history = state.history.slice(0, state.index + 1);
  state.history.push(safeSnapshot);
  state.index = state.history.length - 1;
}

function refreshPreviewDiff(emptyMessage = DEFAULT_LOG_MESSAGE) {
  state.lastPatches = diff(state.actualVdom, state.previewVdom, { mode: state.diffMode });
  renderPatchLog(emptyMessage);
  renderToolbarMeta();
}

function syncEditor(vdom) {
  elements.editor.value = rootToHtml(vdom);
}

function renderPatchLog(emptyMessage = DEFAULT_LOG_MESSAGE) {
  if (state.lastPatches.length === 0) {
    elements.patchLog.innerHTML = `<li class="patch-log__item patch-log__item--empty">${escapeHtml(emptyMessage)}</li>`;
    return;
  }

  elements.patchLog.innerHTML = state.lastPatches
    .map(
      (patch) => `
        <li class="patch-log__item patch-log__item--${escapeHtml(patch.type.toLowerCase())}">
          <strong class="patch-log__type">${escapeHtml(patch.type)}</strong>
          <span class="patch-log__text">${escapeHtml(describePatch(patch))}</span>
        </li>
      `,
    )
    .join("");
}

function renderToolbarMeta() {
  const current = state.index + 1;
  const total = state.history.length;

  elements.historyStatus.textContent = `History ${current} / ${total}`;
  elements.diffModeStatus.textContent = `Mode ${DIFF_MODE_LABELS[state.diffMode]}`;
  elements.patchCount.textContent = `Shown Patches ${state.lastPatches.length}`;
  elements.patchStatus.textContent = state.statusMessage;
  elements.undoButton.disabled = state.index === 0;
  elements.redoButton.disabled = state.index === total - 1;
}

function renderModeButtons() {
  elements.diffModeButtons.forEach((button) => {
    const isActive = button.dataset.diffMode === state.diffMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function renderVdomTrees() {
  renderTreePanel(elements.actualTreeSummary, elements.actualTree, state.actualVdom);
  renderTreePanel(elements.previewTreeSummary, elements.previewTree, state.previewVdom);
}

function renderTreePanel(summaryElement, treeElement, vnode) {
  const stats = getVdomStats(vnode);

  summaryElement.textContent = `Nodes ${stats.nodes} | Elements ${stats.elements} | Text ${stats.texts} | Depth ${stats.maxDepth}`;
  treeElement.textContent = vdomToTreeString(vnode);
}

function flashPatchedElements(targets = []) {
  clearPatchedElements();

  if (targets.length === 0) {
    return;
  }

  targets.forEach((target) => {
    target.classList.remove("is-patched");
    void target.offsetWidth;
    target.classList.add("is-patched");
  });

  state.highlightTimer = window.setTimeout(() => {
    targets.forEach((target) => {
      target.classList.remove("is-patched");
    });
  }, 1400);
}

function clearPatchedElements() {
  if (state.highlightTimer) {
    window.clearTimeout(state.highlightTimer);
    state.highlightTimer = null;
  }

  elements.actualRoot.querySelectorAll(".is-patched").forEach((element) => {
    element.classList.remove("is-patched");
  });
}

// TODO: Persist per-history patch logs if the demo needs timeline playback later.
