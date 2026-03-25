import { diff } from "./diff/diff.js";
import { applyPatches } from "./patch/patch.js";
import { cloneVdom, rootToHtml, summarizePatches } from "./utils/helpers.js";
import { domChildrenToVdom, htmlToVdom } from "./vdom/domToVdom.js";
import { mountVdom } from "./vdom/renderVdom.js";

const elements = {
  actualRoot: document.querySelector("#actual-root"),
  testRoot: document.querySelector("#test-root"),
  editor: document.querySelector("#test-editor"),
  patchButton: document.querySelector("#patch-button"),
  undoButton: document.querySelector("#undo-button"),
  redoButton: document.querySelector("#redo-button"),
  historyStatus: document.querySelector("#history-status"),
  patchStatus: document.querySelector("#patch-status"),
};

const state = {
  history: [],
  index: 0,
};

bootstrap();

function bootstrap() {
  const initialVdom = domChildrenToVdom(elements.actualRoot);

  // TODO: 초기 DOM의 공백 텍스트 노드를 제거해서 path 기준을 안정화합니다.
  mountVdom(elements.actualRoot, initialVdom);
  mountVdom(elements.testRoot, initialVdom);

  state.history = [cloneVdom(initialVdom)];
  state.index = 0;

  syncEditor(initialVdom);
  bindEvents();
  updateToolbar("초기 Virtual DOM을 준비했습니다.");
}

function bindEvents() {
  elements.patchButton.addEventListener("click", handlePatch);
  elements.undoButton.addEventListener("click", handleUndo);
  elements.redoButton.addEventListener("click", handleRedo);
  elements.editor.addEventListener("input", handleEditorInput);
}

function handleEditorInput() {
  const nextVdom = htmlToVdom(elements.editor.value);
  mountVdom(elements.testRoot, nextVdom);
}

function handlePatch() {
  const previousVdom = state.history[state.index];
  const nextVdom = htmlToVdom(elements.editor.value);
  const patches = diff(previousVdom, nextVdom);

  mountVdom(elements.testRoot, nextVdom);

  if (patches.length === 0) {
    updateToolbar("변경점이 없습니다.");
    return;
  }

  applyPatches(elements.actualRoot, patches);
  pushHistory(nextVdom);
  syncEditor(nextVdom);
  updateToolbar(`Patch 적용 완료: ${summarizePatches(patches)}`);
}

function handleUndo() {
  if (state.index === 0) {
    return;
  }

  state.index -= 1;
  applyHistorySnapshot("Undo 완료");
}

function handleRedo() {
  if (state.index >= state.history.length - 1) {
    return;
  }

  state.index += 1;
  applyHistorySnapshot("Redo 완료");
}

function applyHistorySnapshot(message) {
  const snapshot = cloneVdom(state.history[state.index]);
  mountVdom(elements.actualRoot, snapshot);
  mountVdom(elements.testRoot, snapshot);
  syncEditor(snapshot);
  updateToolbar(message);
}

function pushHistory(vdom) {
  const safeSnapshot = cloneVdom(vdom);
  state.history = state.history.slice(0, state.index + 1);
  state.history.push(safeSnapshot);
  state.index = state.history.length - 1;
}

function syncEditor(vdom) {
  elements.editor.value = rootToHtml(vdom);
}

function updateToolbar(message) {
  const current = state.index + 1;
  const total = state.history.length;

  elements.historyStatus.textContent = `History ${current} / ${total}`;
  elements.patchStatus.textContent = message;
  elements.undoButton.disabled = state.index === 0;
  elements.redoButton.disabled = state.index === total - 1;
}

// TODO: 이후에는 patch 목록을 화면에 노출해서 디버깅 정보를 더 자세히 보여줄 수 있습니다.
