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
  summarizePatches,
  vdomToTreeString,
} from "./utils/helpers.js";
import { domChildrenToVdom } from "./vdom/domToVdom.js";
import { mountVdom } from "./vdom/renderVdom.js";

const DIFF_MODE_LABELS = {
  [DIFF_MODES.AUTO]: "Auto (Keyed)",
  [DIFF_MODES.INDEX]: "Index Only",
};

const DEFAULT_LOG_MESSAGE = "Edit the rendered VDOM preview to inspect diff, then click Patch to apply it.";
const DEFAULT_EDITOR_HELP = "Edit the rendered preview directly. Use the block tools to add keys, props, and list items.";
const DIFF_TYPE_PRIORITY = ["REMOVE", "CREATE", "REPLACE", "REORDER", "PROPS", "TEXT"];
const EDITABLE_BLOCK_SELECTOR = "p, li, h1, h2, h3, h4, h5, h6, blockquote, article, section, div";
const PREVIEW_SYNC_MESSAGE = "The current actual and test VDOM match in this mode.";

const elements = {
  actualRoot: document.querySelector("#actual-root"),
  testRoot: document.querySelector("#test-root"),
  editorStatus: document.querySelector("#editor-status"),
  editorSelection: document.querySelector("#editor-selection"),
  editorTools: Array.from(document.querySelectorAll("[data-editor-action]")),
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
  previewObserver: null,
  syncFrame: null,
  pendingSyncMessage: PREVIEW_SYNC_MESSAGE,
  autoKeyCounter: 0,
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
  renderEditorStatus();
  updateSelectedBlockUI();
}

function bindEvents() {
  elements.patchButton.addEventListener("click", handlePatch);
  elements.undoButton.addEventListener("click", handleUndo);
  elements.redoButton.addEventListener("click", handleRedo);
  elements.testRoot.addEventListener("input", handleEditorInput);
  elements.testRoot.addEventListener("click", handleEditorSelectionChange);
  elements.testRoot.addEventListener("keyup", handleEditorSelectionChange);
  document.addEventListener("selectionchange", handleEditorSelectionChange);

  elements.diffModeButtons.forEach((button) => {
    button.addEventListener("click", handleDiffModeChange);
  });

  elements.editorTools.forEach((button) => {
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });
    button.addEventListener("click", handleEditorToolAction);
  });

  startPreviewObserver();
}

function handleEditorInput() {
  queuePreviewSync(PREVIEW_SYNC_MESSAGE);
}

function handleEditorSelectionChange() {
  updateSelectedBlockUI();
}

function handleEditorToolAction(event) {
  const action = event.currentTarget.dataset.editorAction;

  if (!action) {
    return;
  }

  runEditorTool(action);
}

function startPreviewObserver() {
  state.previewObserver = new MutationObserver(() => {
    ensureEditorHasContent();
    queuePreviewSync(PREVIEW_SYNC_MESSAGE);
  });

  observePreviewRoot();
}

function observePreviewRoot() {
  state.previewObserver?.observe(elements.testRoot, {
    characterData: true,
    childList: true,
    subtree: true,
  });
}

function withPreviewObserverPaused(task) {
  if (!state.previewObserver) {
    task();
    return;
  }

  state.previewObserver.disconnect();

  try {
    task();
  } finally {
    observePreviewRoot();
  }
}

function queuePreviewSync(message = PREVIEW_SYNC_MESSAGE) {
  state.pendingSyncMessage = message;

  if (state.syncFrame) {
    return;
  }

  state.syncFrame = window.requestAnimationFrame(() => {
    state.syncFrame = null;

    const nextVdom = readEditorVdom();

    state.previewVdom = cloneVdom(nextVdom);
    renderVdomTrees();
    updatePreviewAnalysis(state.pendingSyncMessage);
    renderEditorStatus();
    updateSelectedBlockUI();
  });
}

function handlePatch() {
  if (state.syncFrame) {
    window.cancelAnimationFrame(state.syncFrame);
    state.syncFrame = null;
  }

  const nextVdom = readEditorVdom();
  const patches = diff(state.actualVdom, nextVdom, { mode: state.diffMode });

  state.previewVdom = cloneVdom(nextVdom);
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
  renderPreviewDecorations();
  renderActualDecorations(patches, state.keyReport);
  renderEditorStatus();
  updateSelectedBlockUI();
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
  updatePreviewAnalysis("The current actual and test VDOM match in this mode.");
  renderEditorStatus();
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
  renderEditorStatus();
  updateSelectedBlockUI();
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
  withPreviewObserverPaused(() => {
    mountVdom(elements.testRoot, vdom);
    ensureEditorHasContent();
  });
}

function readEditorVdom() {
  stripEditorArtifacts(elements.testRoot);
  clearSurfaceAnnotations(elements.testRoot);
  return domChildrenToVdom(elements.testRoot);
}

function renderEditorStatus() {
  if (!elements.editorStatus) {
    return;
  }

  elements.editorStatus.textContent = DEFAULT_EDITOR_HELP;
  elements.editorStatus.classList.remove("editor__status--error");
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
  elements.patchButton.disabled = false;
  elements.undoButton.disabled = state.index === 0;
  elements.redoButton.disabled = state.index === total - 1;
}

function runEditorTool(action) {
  const activeBlock = getSelectedEditableBlock() || ensureEditorHasContent();
  let focusTarget = activeBlock;

  switch (action) {
    case "insert-paragraph":
      focusTarget = insertBlockAfter(activeBlock, createBlockElement("p", "New paragraph"));
      state.statusMessage = "Inserted a new paragraph block.";
      break;
    case "insert-heading":
      focusTarget = insertBlockAfter(activeBlock, createBlockElement("h3", "New heading"));
      state.statusMessage = "Inserted a new heading block.";
      break;
    case "insert-list":
      focusTarget = insertListItem(activeBlock, false);
      state.statusMessage = "Inserted a new list item block.";
      break;
    case "insert-keyed-item":
      focusTarget = insertListItem(activeBlock, true);
      state.statusMessage = "Inserted a new keyed list item.";
      break;
    case "assign-key":
      focusTarget = assignKeyToBlock(activeBlock);
      break;
    case "toggle-prop":
      focusTarget = toggleBlockProp(activeBlock);
      break;
    case "duplicate-block":
      focusTarget = duplicateBlock(activeBlock);
      state.statusMessage = "Duplicated the selected block.";
      break;
    case "delete-block":
      focusTarget = deleteBlock(activeBlock);
      state.statusMessage = "Deleted the selected block.";
      break;
    default:
      return;
  }

  ensureEditorHasContent();
  updateSelectedBlockUI(focusTarget);
  focusBlock(focusTarget);
  queuePreviewSync("Editor tools updated the preview VDOM.");
  renderToolbarMeta();
}

function ensureEditorHasContent() {
  const firstBlock = elements.testRoot.firstElementChild;

  if (firstBlock) {
    return firstBlock;
  }

  const paragraph = createBlockElement("p", "Start typing here.");
  elements.testRoot.appendChild(paragraph);
  return paragraph;
}

function getSelectedEditableBlock() {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  return getEditableBlockFromNode(selection.anchorNode);
}

function getEditableBlockFromNode(node) {
  const element = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;

  if (!element || !elements.testRoot.contains(element)) {
    return null;
  }

  const block = element.closest(EDITABLE_BLOCK_SELECTOR);

  if (!block || block === elements.testRoot || !elements.testRoot.contains(block)) {
    return null;
  }

  return block;
}

function updateSelectedBlockUI(forcedBlock = null) {
  stripEditorArtifacts(elements.testRoot);

  const activeBlock = forcedBlock || getSelectedEditableBlock();

  if (!activeBlock || !elements.testRoot.contains(activeBlock)) {
    if (elements.editorSelection) {
      elements.editorSelection.textContent = "Selected: none";
    }
    return;
  }

  activeBlock.dataset.editorSelected = "true";

  if (!elements.editorSelection) {
    return;
  }

  const tagName = activeBlock.tagName.toLowerCase();
  const key = activeBlock.getAttribute("data-key");
  const tone = activeBlock.getAttribute("data-tone");
  const parts = [`Selected: <${tagName}>`];

  if (key) {
    parts.push(`key ${key}`);
  }

  if (tone) {
    parts.push(`prop ${tone}`);
  }

  elements.editorSelection.textContent = parts.join(" | ");
}

function stripEditorArtifacts(rootElement) {
  rootElement.querySelectorAll("[data-editor-selected]").forEach((element) => {
    element.removeAttribute("data-editor-selected");
  });
}

function createBlockElement(tagName, textContent) {
  const element = document.createElement(tagName);
  element.textContent = textContent;
  return element;
}

function insertBlockAfter(referenceBlock, newBlock) {
  if (!referenceBlock || !referenceBlock.parentNode) {
    elements.testRoot.appendChild(newBlock);
    return newBlock;
  }

  referenceBlock.parentNode.insertBefore(newBlock, referenceBlock.nextSibling);
  return newBlock;
}

function insertListItem(referenceBlock, keyed) {
  const currentItem = referenceBlock?.closest("li");
  const currentList = currentItem?.parentElement?.matches("ul, ol") ? currentItem.parentElement : null;
  const listItem = createBlockElement("li", keyed ? "New keyed item" : "New list item");

  if (keyed) {
    listItem.setAttribute("data-key", generateAutoKey("item"));
  }

  if (currentItem && currentList) {
    currentList.insertBefore(listItem, currentItem.nextSibling);
    return listItem;
  }

  const list = document.createElement("ul");
  list.appendChild(listItem);
  insertBlockAfter(referenceBlock, list);
  return listItem;
}

function assignKeyToBlock(block) {
  if (!block) {
    return ensureEditorHasContent();
  }

  if (block.hasAttribute("data-key")) {
    state.statusMessage = `Selected block already has key ${block.getAttribute("data-key")}.`;
    return block;
  }

  const nextKey = generateAutoKey(block.tagName.toLowerCase());
  block.setAttribute("data-key", nextKey);
  state.statusMessage = `Assigned key ${nextKey} to the selected block.`;
  return block;
}

function toggleBlockProp(block) {
  if (!block) {
    return ensureEditorHasContent();
  }

  const nextTone = block.getAttribute("data-tone") === "accent" ? null : "accent";

  if (nextTone === null) {
    block.removeAttribute("data-tone");
    state.statusMessage = "Removed the accent prop from the selected block.";
    return block;
  }

  block.setAttribute("data-tone", nextTone);
  state.statusMessage = "Applied an accent prop to the selected block.";
  return block;
}

function duplicateBlock(block) {
  if (!block) {
    return ensureEditorHasContent();
  }

  const clone = block.cloneNode(true);
  refreshKeysInSubtree(clone);
  return insertBlockAfter(block, clone);
}

function deleteBlock(block) {
  if (!block || !block.parentNode) {
    return ensureEditorHasContent();
  }

  const fallback = getNextEditableSibling(block) || getPreviousEditableSibling(block);
  const listParent = block.parentElement?.matches("ul, ol") ? block.parentElement : null;

  block.remove();

  if (listParent && listParent.children.length === 0) {
    const listFallback = getNextEditableSibling(listParent) || getPreviousEditableSibling(listParent);
    listParent.remove();
    return listFallback || ensureEditorHasContent();
  }

  return fallback || ensureEditorHasContent();
}

function getNextEditableSibling(element) {
  let current = element?.nextElementSibling ?? null;

  while (current) {
    if (current.matches(EDITABLE_BLOCK_SELECTOR) || current.matches("ul, ol")) {
      return current.matches("ul, ol") ? current.firstElementChild : current;
    }

    current = current.nextElementSibling;
  }

  return null;
}

function getPreviousEditableSibling(element) {
  let current = element?.previousElementSibling ?? null;

  while (current) {
    if (current.matches(EDITABLE_BLOCK_SELECTOR) || current.matches("ul, ol")) {
      return current.matches("ul, ol") ? current.lastElementChild : current;
    }

    current = current.previousElementSibling;
  }

  return null;
}

function refreshKeysInSubtree(rootNode) {
  if (rootNode.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  if (rootNode.hasAttribute("data-key")) {
    rootNode.setAttribute("data-key", generateAutoKey(rootNode.tagName.toLowerCase()));
  }

  rootNode.querySelectorAll("[data-key]").forEach((element) => {
    element.setAttribute("data-key", generateAutoKey(element.tagName.toLowerCase()));
  });
}

function generateAutoKey(prefix = "node") {
  state.autoKeyCounter += 1;
  return `${prefix}-${state.autoKeyCounter}`;
}

function focusBlock(block) {
  if (!block || !block.isConnected) {
    elements.testRoot.focus();
    return;
  }

  const target = block.matches("ul, ol") ? block.firstElementChild || block : block;
  const selection = window.getSelection();
  const range = document.createRange();

  if (!target.firstChild) {
    target.appendChild(document.createTextNode(""));
  }

  range.selectNodeContents(target);
  range.collapse(false);
  selection?.removeAllRanges();
  selection?.addRange(range);
  elements.testRoot.focus();
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
    elements.keyReport.innerHTML = `<li class="key-report__item key-report__item--empty">No keyed elements found. Add a <code>"key"</code> field to compare identity.</li>`;
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
