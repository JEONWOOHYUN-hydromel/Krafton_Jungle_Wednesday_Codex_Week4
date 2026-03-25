import { diff } from "./diff/diff.js";
import { applyPatches } from "./patch/patch.js";
import { cloneVdom, describePatch, escapeHtml, rootToHtml, summarizePatches } from "./utils/helpers.js";
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
  patchLog: document.querySelector("#patch-log"),
};

const state = {
  history: [],
  index: 0,
  lastPatches: [],
};

bootstrap();

function bootstrap() {
  const initialVdom = domChildrenToVdom(elements.actualRoot);

  mountVdom(elements.actualRoot, initialVdom);
  mountVdom(elements.testRoot, initialVdom);

  state.history = [cloneVdom(initialVdom)];
  state.index = 0;
  state.lastPatches = [];

  syncEditor(initialVdom);
  bindEvents();
  renderPatchLog();
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
  state.lastPatches = patches;
  renderPatchLog();

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
  state.lastPatches = [];
  applyHistorySnapshot("Undo 완료");
}

function handleRedo() {
  if (state.index >= state.history.length - 1) {
    return;
  }

  state.index += 1;
  state.lastPatches = [];
  applyHistorySnapshot("Redo 완료");
}

function applyHistorySnapshot(message) {
  const snapshot = cloneVdom(state.history[state.index]);
  mountVdom(elements.actualRoot, snapshot);
  mountVdom(elements.testRoot, snapshot);
  syncEditor(snapshot);
  renderPatchLog(`${message}: 저장된 스냅샷을 다시 렌더링했습니다.`);
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

function renderPatchLog(message = "Patch를 실행하면 상세 변경 로그가 여기에 표시됩니다.") {
  if (state.lastPatches.length === 0) {
    elements.patchLog.innerHTML = `<li class="patch-log__item patch-log__item--empty">${message}</li>`;
    return;
  }

  elements.patchLog.innerHTML = state.lastPatches
    .map(
      (patch) => `
        <li class="patch-log__item">
          <strong class="patch-log__type">${escapeHtml(patch.type)}</strong>
          <span class="patch-log__text">${escapeHtml(describePatch(patch))}</span>
        </li>
      `,
    )
    .join("");
}

function updateToolbar(message) {
  const current = state.index + 1;
  const total = state.history.length;

  elements.historyStatus.textContent = `History ${current} / ${total}`;
  elements.patchStatus.textContent = message;
  elements.undoButton.disabled = state.index === 0;
  elements.redoButton.disabled = state.index === total - 1;
}

// TODO: patch 로그를 history 단위로 보존해서 특정 시점의 diff를 다시 조회하는 기능도 붙일 수 있습니다.
