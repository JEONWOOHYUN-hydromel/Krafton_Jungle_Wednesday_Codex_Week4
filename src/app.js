import { DIFF_MODES, diff } from "./diff/diff.js";
import { applyPatches } from "./patch/patch.js";
import {
  TEXT_NODE,
  buildKeyReport,
  cloneVdom,
  describePatch,
  escapeHtml,
  formatPath,
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
const DIFF_TYPE_PRIORITY = ["REMOVE", "CREATE", "REPLACE", "REORDER", "PROPS", "TEXT"];

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
  keySummary: document.querySelector("#key-summary"),
  keyReport: document.querySelector("#key-report"),
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
  keyReport: null,
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
  updatePreviewAnalysis(DEFAULT_LOG_MESSAGE);
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
  updatePreviewAnalysis("The current actual and test VDOM match in this mode.");
}

function handlePatch() {
  const nextVdom = htmlToVdom(elements.editor.value);
  const patches = diff(state.actualVdom, nextVdom, { mode: state.diffMode });

  state.previewVdom = cloneVdom(nextVdom);
  mountVdom(elements.testRoot, nextVdom);
  renderVdomTrees();
  state.lastPatches = patches;
  state.keyReport = buildKeyReport(state.actualVdom, state.previewVdom);
  renderPatchLog("No changes to apply.");
  renderKeyInspector();
  renderPreviewDecorations();

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
  renderActualDecorations(patches, state.keyReport);
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
  state.keyReport = buildKeyReport(state.actualVdom, state.previewVdom);
  state.statusMessage = message;

  mountVdom(elements.actualRoot, snapshot);
  mountVdom(elements.testRoot, snapshot);
  syncEditor(snapshot);
  clearPatchedElements();
  renderVdomTrees();
  updatePreviewAnalysis(`${message} Actual and test VDOM are synced again.`);
}

function pushHistory(vdom) {
  const safeSnapshot = cloneVdom(vdom);

  state.history = state.history.slice(0, state.index + 1);
  state.history.push(safeSnapshot);
  state.index = state.history.length - 1;
}

function updatePreviewAnalysis(emptyMessage = DEFAULT_LOG_MESSAGE) {
  clearActualDecorations();
  state.lastPatches = diff(state.actualVdom, state.previewVdom, { mode: state.diffMode });
  state.keyReport = buildKeyReport(state.actualVdom, state.previewVdom);
  renderPatchLog(emptyMessage);
  renderKeyInspector();
  renderPreviewDecorations();
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

function renderKeyInspector() {
  const report = state.keyReport;

  if (!report) {
    elements.keySummary.textContent = "No key report available yet.";
    elements.keyReport.innerHTML = `<li class="key-report__item key-report__item--empty">${escapeHtml(DEFAULT_LOG_MESSAGE)}</li>`;
    return;
  }

  const summary = report.summary;
  elements.keySummary.textContent =
    `Actual ${summary.actualKeys} | Test ${summary.previewKeys} | Preserved ${summary.preserved} | Moved ${summary.moved} | Added ${summary.added} | Removed ${summary.removed}`;

  const groups = [
    createKeyGroupMarkup("Preserved", "preserved", report.preserved, (entry) => `${entry.key} stays at ${entry.pathLabel}`),
    createKeyGroupMarkup("Moved", "moved", report.moved, (entry) => `${entry.key} moves ${entry.fromPathLabel} -> ${entry.toPathLabel}`),
    createKeyGroupMarkup("Added", "added", report.added, (entry) => `${entry.key} appears at ${entry.pathLabel}`),
    createKeyGroupMarkup("Removed", "removed", report.removed, (entry) => `${entry.key} disappears from ${entry.pathLabel}`),
  ].filter(Boolean);

  if (groups.length === 0) {
    elements.keyReport.innerHTML = `<li class="key-report__item key-report__item--empty">No keyed elements found. Add <code>data-key</code> to compare identity.</li>`;
    return;
  }

  elements.keyReport.innerHTML = groups.join("");
}

function createKeyGroupMarkup(label, stateName, entries, formatter) {
  if (!entries || entries.length === 0) {
    return "";
  }

  return `
    <li class="key-report__group">
      <div class="key-report__group-header">
        <strong>${escapeHtml(label)}</strong>
        <span class="key-report__count">${entries.length}</span>
      </div>
      <ul class="key-report__group-list">
        ${entries
          .map(
            (entry) => `
              <li class="key-report__item key-report__item--${escapeHtml(stateName)}">
                <span class="key-report__badge">${escapeHtml(entry.tagName)}</span>
                <span class="key-report__text">${escapeHtml(formatter(entry))}</span>
              </li>
            `,
          )
          .join("")}
      </ul>
    </li>
  `;
}

function renderPreviewDecorations() {
  const surfaceState = buildPreviewSurfaceState();
  applySurfaceAnnotations(elements.testRoot, state.previewVdom, surfaceState);
}

function renderActualDecorations(patches, keyReport) {
  const surfaceState = buildActualSurfaceState(patches, keyReport);
  applySurfaceAnnotations(elements.actualRoot, state.actualVdom, surfaceState);
}

function buildPreviewSurfaceState() {
  const annotationMap = createAnnotationMapFromPatches(state.lastPatches);
  const keyBadges = new Map();

  state.keyReport?.moved.forEach((entry) => {
    addAnnotation(annotationMap, entry.pathLabel, "REORDER", `key ${entry.key} moved from ${entry.fromPathLabel}`);
  });

  state.keyReport?.added.forEach((entry) => {
    addAnnotation(annotationMap, entry.pathLabel, "CREATE", `key ${entry.key} is new in test DOM`);
  });

  state.keyReport?.preserved.forEach((entry) => {
    keyBadges.set(entry.pathLabel, {
      label: `key:${entry.key} | kept`,
      status: "preserved",
      tooltip: `Key ${entry.key} is preserved.`,
    });
  });

  state.keyReport?.moved.forEach((entry) => {
    keyBadges.set(entry.pathLabel, {
      label: `key:${entry.key} | moved`,
      status: "moved",
      tooltip: `Key ${entry.key} moved from ${entry.fromPathLabel} to ${entry.toPathLabel}.`,
    });
  });

  state.keyReport?.added.forEach((entry) => {
    keyBadges.set(entry.pathLabel, {
      label: `key:${entry.key} | new`,
      status: "added",
      tooltip: `Key ${entry.key} is newly introduced.`,
    });
  });

  return { annotationMap, keyBadges };
}

function buildActualSurfaceState(patches, keyReport) {
  const annotationMap = createAnnotationMapFromPatches(patches);
  const keyBadges = new Map();

  keyReport?.added.forEach((entry) => {
    keyBadges.set(entry.pathLabel, {
      label: `new key:${entry.key}`,
      status: "new",
      tooltip: `This key was newly introduced in the last patch.`,
    });
  });

  return { annotationMap, keyBadges };
}

function createAnnotationMapFromPatches(patches = []) {
  const annotationMap = new Map();

  patches.forEach((patch) => {
    const targetPath = getPatchTargetPath(patch);
    addAnnotation(annotationMap, formatPath(targetPath), patch.type, describePatch(patch));
  });

  return annotationMap;
}

function addAnnotation(annotationMap, pathLabel, type, message) {
  if (!annotationMap.has(pathLabel)) {
    annotationMap.set(pathLabel, {
      types: new Set(),
      messages: [],
    });
  }

  const entry = annotationMap.get(pathLabel);
  entry.types.add(type);

  if (message) {
    entry.messages.push(message);
  }
}

function getPatchTargetPath(patch) {
  if (patch.type === "TEXT" || patch.type === "REMOVE") {
    return patch.path.slice(0, -1);
  }

  return patch.path;
}

function applySurfaceAnnotations(rootElement, rootVdom, surfaceState) {
  clearSurfaceAnnotations(rootElement);

  const childNodes = Array.from(rootElement.childNodes);
  (rootVdom?.children || []).forEach((childVNode, index) => {
    walkAnnotatedDom(childNodes[index], childVNode, [index], surfaceState);
  });
}

function walkAnnotatedDom(domNode, vnode, path, surfaceState) {
  if (!domNode || !vnode || vnode.type === TEXT_NODE) {
    return;
  }

  if (domNode.nodeType === Node.ELEMENT_NODE) {
    const pathLabel = formatPath(path);
    const annotation = surfaceState.annotationMap.get(pathLabel);
    const keyBadge = surfaceState.keyBadges.get(pathLabel);
    const tooltipParts = [];

    if (annotation) {
      const primaryType = pickPrimaryType(annotation.types);
      const orderedTypes = DIFF_TYPE_PRIORITY.filter((type) => annotation.types.has(type));

      domNode.dataset.diffVisualState = primaryType.toLowerCase();
      domNode.dataset.diffBadge = primaryType;
      tooltipParts.push(`Diff case: ${orderedTypes.join(", ")}`);
      tooltipParts.push(...annotation.messages);
    }

    if (keyBadge) {
      domNode.dataset.keyVisualState = keyBadge.status;
      domNode.dataset.keyBadge = keyBadge.label;
      tooltipParts.push(keyBadge.tooltip);
    }

    if (tooltipParts.length > 0) {
      const uniqueTooltip = [...new Set(tooltipParts)];

      domNode.dataset.diffTitle = uniqueTooltip.join("\n");
      domNode.title = domNode.dataset.diffTitle;
    }
  }

  const domChildren = Array.from(domNode.childNodes);
  (vnode.children || []).forEach((childVNode, index) => {
    walkAnnotatedDom(domChildren[index], childVNode, [...path, index], surfaceState);
  });
}

function pickPrimaryType(types) {
  for (const type of DIFF_TYPE_PRIORITY) {
    if (types.has(type)) {
      return type;
    }
  }

  return "TEXT";
}

function clearSurfaceAnnotations(rootElement) {
  rootElement.querySelectorAll("[data-diff-visual-state], [data-key-badge], [data-diff-title]").forEach((element) => {
    element.removeAttribute("data-diff-visual-state");
    element.removeAttribute("data-diff-badge");
    element.removeAttribute("data-key-visual-state");
    element.removeAttribute("data-key-badge");
    element.removeAttribute("data-diff-title");
    element.removeAttribute("title");
  });
}

function clearActualDecorations() {
  clearSurfaceAnnotations(elements.actualRoot);
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
