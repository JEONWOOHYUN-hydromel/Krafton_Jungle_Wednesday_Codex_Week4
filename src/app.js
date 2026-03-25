import { diff } from "./diff/diff.js";
import { applyPatches } from "./patch/patch.js";
import {
  ROOT_NODE,
  TEXT_NODE,
  cloneVdom,
  createElementVNode,
  createTextVNode,
  escapeHtml,
  formatPath,
  getVNodeKey,
  isKeySegment,
} from "./utils/helpers.js";
import { domChildrenToVdom } from "./vdom/domToVdom.js";
import { mountVdom } from "./vdom/renderVdom.js";

const DIFF_TYPE_PRIORITY = ["REMOVE", "CREATE", "REPLACE", "REORDER", "PROPS", "TEXT"];
const PATCH_LABELS_KO = {
  TEXT: "텍스트",
  PROPS: "속성",
  CREATE: "생성",
  REMOVE: "삭제",
  REPLACE: "교체",
  REORDER: "재정렬",
};
const DEFAULT_PREVIEW_STATUS = "오른쪽에서 diff 케이스를 하나 선택하면 Test VDOM이 만들어집니다.";
const DEFAULT_ACTUAL_STATUS = "선택한 테스트 케이스를 적용하면 Actual DOM이 갱신됩니다.";

const SCENARIOS = [
  {
    id: "text",
    label: "1. 텍스트",
    caseType: "TEXT",
    description: "DOM 구조는 그대로 두고 텍스트 노드만 바꿉니다.",
    apply(vdom) {
      const nextText = toggleTextVariant(
        vdom,
        "intro-copy",
        "이 문장은 텍스트만 바뀐 상태입니다. 주변 DOM 구조와 속성은 그대로 유지됩니다.",
        "이 영역은 실제 DOM 대상입니다. 오른쪽 테스트 영역에서는 먼저 미리보기 Virtual DOM을 만든 뒤, Patch로 변경된 부분만 적용합니다.",
      );

      return {
        vdom,
        note: `텍스트 변경 케이스를 불러왔습니다: "${nextText}"`,
      };
    },
  },
  {
    id: "props",
    label: "2. 속성",
    caseType: "PROPS",
    description: "노드는 유지한 채 속성만 추가하거나 제거합니다.",
    apply(vdom) {
      const enabled = toggleNodeProp(vdom, "key-callout", "data-tone", "accent");
      return {
        vdom,
        note: enabled
          ? '`data-tone="accent"` 속성을 추가하는 케이스를 불러왔습니다.'
          : "강조 속성을 제거하는 케이스를 불러왔습니다.",
      };
    },
  },
  {
    id: "create",
    label: "3. 생성",
    caseType: "CREATE",
    description: "새 keyed 리스트 항목을 추가해서 빠진 노드만 생성하도록 만듭니다.",
    apply(vdom) {
      const nextKey = getNextHistoryKey(vdom, "core-list");
      const nextIndex = Number(nextKey.split("-").at(-1));
      appendListItem(vdom, "core-list", {
        key: nextKey,
        text: `히스토리 스냅샷 ${nextIndex}이 새 keyed 항목으로 추가되었습니다.`,
      });

      return {
        vdom,
        note: `key "${nextKey}"를 가진 새 리스트 항목을 추가하는 케이스를 불러왔습니다.`,
      };
    },
  },
  {
    id: "remove",
    label: "4. 삭제",
    caseType: "REMOVE",
    description: "keyed 리스트 항목 하나만 삭제하고 나머지 형제 노드는 유지합니다.",
    apply(vdom) {
      const removedKey = removeOneListItem(vdom, "core-list");

      return {
        vdom,
        note: removedKey
          ? `key "${removedKey}" 항목을 삭제하는 케이스를 불러왔습니다.`
          : "삭제할 keyed 항목이 더 이상 없어 변경이 발생하지 않았습니다.",
      };
    },
  },
  {
    id: "replace",
    label: "5. 교체",
    caseType: "REPLACE",
    description: "노드 타입 자체를 바꿔서 완전한 노드 교체가 일어나게 합니다.",
    apply(vdom) {
      const nextTag = replaceCalloutNode(vdom, "key-callout");

      return {
        vdom,
        note:
          nextTag === "p"
            ? "blockquote가 paragraph로 바뀌는 교체 케이스를 불러왔습니다."
            : "paragraph가 blockquote로 다시 바뀌는 교체 케이스를 불러왔습니다.",
      };
    },
  },
];

const elements = {
  actualRoot: document.querySelector("#actual-root"),
  actualStatus: document.querySelector("#actual-status"),
  actualChanges: document.querySelector("#actual-changes"),
  testRoot: document.querySelector("#test-root"),
  testStatus: document.querySelector("#test-status"),
  testChanges: document.querySelector("#test-changes"),
  scenarioTitle: document.querySelector("#scenario-title"),
  scenarioDescription: document.querySelector("#scenario-description"),
  scenarioExpected: document.querySelector("#scenario-expected"),
  scenarioButtons: Array.from(document.querySelectorAll("[data-scenario-id]")),
  patchButton: document.querySelector("#patch-button"),
  resetButton: document.querySelector("#reset-button"),
  undoButton: document.querySelector("#undo-button"),
  redoButton: document.querySelector("#redo-button"),
};

const state = {
  baseVdom: null,
  actualVdom: null,
  previewVdom: null,
  selectedScenarioId: null,
  pendingPatches: [],
  lastAppliedPatches: [],
  actualChangeFeed: [],
  history: [],
  index: 0,
  highlightTimer: null,
};

bootstrap();

function bootstrap() {
  if (!elements.actualRoot || !elements.testRoot) {
    return;
  }

  const initialVdom = domChildrenToVdom(elements.actualRoot);

  state.baseVdom = cloneVdom(initialVdom);
  state.actualVdom = cloneVdom(initialVdom);
  state.previewVdom = cloneVdom(initialVdom);
  state.history = [cloneVdom(initialVdom)];
  state.index = 0;

  mountVdom(elements.actualRoot, state.actualVdom);
  mountVdom(elements.testRoot, state.previewVdom);
  bindEvents();
  renderAll();
}

function bindEvents() {
  elements.scenarioButtons.forEach((button) => {
    button.addEventListener("click", handleScenarioSelect);
  });

  elements.patchButton?.addEventListener("click", handlePatch);
  elements.resetButton?.addEventListener("click", handleReset);
  elements.undoButton?.addEventListener("click", handleUndo);
  elements.redoButton?.addEventListener("click", handleRedo);
}

function handleScenarioSelect(event) {
  const scenarioId = event.currentTarget.dataset.scenarioId;
  const scenario = SCENARIOS.find((entry) => entry.id === scenarioId);

  if (!scenario) {
    return;
  }

  const nextPreview = cloneVdom(state.actualVdom);
  const result = scenario.apply(nextPreview);

  state.selectedScenarioId = scenario.id;
  state.previewVdom = cloneVdom(result.vdom);
  state.pendingPatches = diff(state.actualVdom, state.previewVdom);

  mountVdom(elements.testRoot, state.previewVdom);
  renderScenarioMeta(result.note);
  renderPreviewChangeFeed();
  renderPreviewDecorations();
  renderScenarioButtons();
  updateButtons();
}

function handlePatch() {
  if (state.pendingPatches.length === 0) {
    return;
  }

  const previousActual = cloneVdom(state.actualVdom);
  const appliedPatches = diff(state.actualVdom, state.previewVdom);
  const changeFeed = buildActualChangeFeed(previousActual, appliedPatches);
  const changedElements = applyPatches(elements.actualRoot, appliedPatches);

  flashPatchedElements(changedElements);

  state.actualVdom = cloneVdom(state.previewVdom);
  state.lastAppliedPatches = appliedPatches;
  state.actualChangeFeed = changeFeed;
  state.selectedScenarioId = null;
  state.pendingPatches = [];
  pushHistory(state.actualVdom);

  renderActualDecorations(appliedPatches);
  mountVdom(elements.testRoot, state.actualVdom);
  state.previewVdom = cloneVdom(state.actualVdom);
  renderAll(`패치를 적용했습니다: ${summarizePatchTypes(appliedPatches)}. 다음 diff 케이스를 선택하세요.`);
}

function handleReset() {
  const snapshot = cloneVdom(state.baseVdom);

  state.actualVdom = cloneVdom(snapshot);
  state.previewVdom = cloneVdom(snapshot);
  state.selectedScenarioId = null;
  state.pendingPatches = [];
  state.lastAppliedPatches = [];
  state.actualChangeFeed = [];
  state.history = [cloneVdom(snapshot)];
  state.index = 0;

  mountVdom(elements.actualRoot, snapshot);
  mountVdom(elements.testRoot, snapshot);
  clearPatchedElements();
  clearSurfaceAnnotations(elements.actualRoot);
  renderAll("초기 Actual DOM 상태로 되돌렸습니다.");
}

function handleUndo() {
  if (state.index === 0) {
    return;
  }

  state.index -= 1;
  applyHistorySnapshot("이전 Actual DOM 스냅샷으로 되돌렸습니다.");
}

function handleRedo() {
  if (state.index >= state.history.length - 1) {
    return;
  }

  state.index += 1;
  applyHistorySnapshot("다음 Actual DOM 스냅샷으로 다시 이동했습니다.");
}

function applyHistorySnapshot(message) {
  const snapshot = cloneVdom(state.history[state.index]);

  state.actualVdom = cloneVdom(snapshot);
  state.previewVdom = cloneVdom(snapshot);
  state.selectedScenarioId = null;
  state.pendingPatches = [];
  state.lastAppliedPatches = [];
  state.actualChangeFeed = [];

  mountVdom(elements.actualRoot, snapshot);
  mountVdom(elements.testRoot, snapshot);
  clearPatchedElements();
  clearSurfaceAnnotations(elements.actualRoot);
  renderAll(message);
}

function pushHistory(vdom) {
  const safeSnapshot = cloneVdom(vdom);
  state.history = state.history.slice(0, state.index + 1);
  state.history.push(safeSnapshot);
  state.index = state.history.length - 1;
}

function renderAll(statusMessage = DEFAULT_PREVIEW_STATUS) {
  renderScenarioButtons();
  renderScenarioMeta(statusMessage);
  renderPreviewChangeFeed();
  renderActualChangeFeed();
  renderPreviewDecorations();
  renderActualStatus();
  updateButtons();
}

function renderScenarioButtons() {
  elements.scenarioButtons.forEach((button) => {
    const isActive = button.dataset.scenarioId === state.selectedScenarioId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function renderScenarioMeta(message) {
  const scenario = SCENARIOS.find((entry) => entry.id === state.selectedScenarioId);

  if (!scenario) {
    elements.scenarioTitle.textContent = "Diff 케이스를 선택하세요";
    elements.scenarioDescription.textContent = DEFAULT_PREVIEW_STATUS;
    elements.scenarioExpected.textContent = "예상 패치 타입: 없음";
    elements.testStatus.textContent = message || DEFAULT_PREVIEW_STATUS;
    return;
  }

  elements.scenarioTitle.textContent = `${scenario.label} 시연`;
  elements.scenarioDescription.textContent = scenario.description;
  elements.scenarioExpected.textContent = `예상 패치 타입: ${PATCH_LABELS_KO[scenario.caseType]}`;
  elements.testStatus.textContent = message;
}

function renderPreviewChangeFeed() {
  if (state.pendingPatches.length === 0) {
    elements.testChanges.innerHTML = '<li class="change-list__item change-list__item--empty">Test DOM과 Actual DOM이 현재 동일합니다.</li>';
    return;
  }

  elements.testChanges.innerHTML = state.pendingPatches
    .map(
      (patch) => `
        <li class="change-list__item change-list__item--pending">
          <span class="change-list__badge">${escapeHtml(PATCH_LABELS_KO[patch.type] || patch.type)}</span>
          <span class="change-list__text">${escapeHtml(describePatchKo(patch))}</span>
        </li>
      `,
    )
    .join("");
}

function renderActualChangeFeed() {
  if (state.actualChangeFeed.length === 0) {
    elements.actualChanges.innerHTML =
      '<li class="change-list__item change-list__item--empty">아직 적용된 패치가 없습니다. Actual DOM은 변경되지 않았습니다.</li>';
    return;
  }

  elements.actualChanges.innerHTML = state.actualChangeFeed
    .map(
      (entry) => `
        <li class="change-list__item change-list__item--${escapeHtml(entry.kind)}">
          <span class="change-list__prefix">${escapeHtml(entry.prefix)}</span>
          <span class="change-list__text">${escapeHtml(entry.text)}</span>
        </li>
      `,
    )
    .join("");
}

function renderActualStatus() {
  const lastPatchSummary = state.lastAppliedPatches.length > 0 ? summarizePatchTypes(state.lastAppliedPatches) : DEFAULT_ACTUAL_STATUS;
  elements.actualStatus.textContent = lastPatchSummary;
}

function updateButtons() {
  elements.patchButton.disabled = state.pendingPatches.length === 0;
  elements.undoButton.disabled = state.index === 0;
  elements.redoButton.disabled = state.index === state.history.length - 1;
}

function buildActualChangeFeed(oldVdom, patches) {
  const entries = [];

  patches.forEach((patch) => {
    const previousNode = getVNodeAtPath(oldVdom, patch.path);

    switch (patch.type) {
      case "CREATE":
        entries.push({
          kind: "add",
          prefix: "+",
          text: `${formatVNodeSummary(patch.node)} 생성됨 (${formatPath(patch.path)})`,
        });
        break;
      case "REMOVE":
        entries.push({
          kind: "remove",
          prefix: "-",
          text: `${formatVNodeSummary(previousNode)} 삭제됨 (${formatPath(patch.path)})`,
        });
        break;
      case "REPLACE":
        entries.push({
          kind: "edit",
          prefix: "~",
          text: `노드 교체: ${formatVNodeSummary(previousNode)} -> ${formatVNodeSummary(patch.node)} (${formatPath(patch.path)})`,
        });
        break;
      case "TEXT":
        entries.push({
          kind: "edit",
          prefix: "~",
          text: `텍스트 변경: "${truncateText(previousNode?.value || "", 84)}" -> "${truncateText(patch.value || "", 84)}"`,
        });
        break;
      case "PROPS":
        Object.entries(patch.props || {}).forEach(([name, value]) => {
          const previousValue = previousNode?.props?.[name] ?? null;
          entries.push({
            kind: "edit",
            prefix: "~",
            text: `${formatVNodeSummary(previousNode)} ${name}: ${formatNullable(previousValue)} -> ${formatNullable(value)}`,
          });
        });
        break;
      case "REORDER":
        entries.push({
          kind: "edit",
          prefix: "~",
          text: `${formatVNodeSummary(previousNode)} 내부 keyed 자식 순서가 변경되었습니다.`,
        });
        break;
      default:
        break;
    }
  });

  return entries;
}

function summarizePatchTypes(patches) {
  const counts = patches.reduce((summary, patch) => {
    summary[patch.type] = (summary[patch.type] || 0) + 1;
    return summary;
  }, {});

  return Object.entries(counts)
    .map(([type, count]) => `${PATCH_LABELS_KO[type] || type} ${count}개`)
    .join(" | ");
}

function renderPreviewDecorations() {
  const annotationMap = createAnnotationMapFromPatches(state.pendingPatches);
  const keyBadges = createKeyBadgeMap(state.pendingPatches);
  applySurfaceAnnotations(elements.testRoot, state.previewVdom, { annotationMap, keyBadges });
}

function renderActualDecorations(patches) {
  const annotationMap = createAnnotationMapFromPatches(patches);
  const keyBadges = createKeyBadgeMap(patches);
  applySurfaceAnnotations(elements.actualRoot, state.actualVdom, { annotationMap, keyBadges });
}

function createAnnotationMapFromPatches(patches = []) {
  const annotationMap = new Map();

  patches.forEach((patch) => {
    const targetPath = getPatchTargetPath(patch);
    addAnnotation(annotationMap, formatPath(targetPath), patch.type, describePatchKo(patch));
  });

  return annotationMap;
}

function createKeyBadgeMap(patches = []) {
  const keyBadges = new Map();

  patches.forEach((patch) => {
    if (patch.type !== "CREATE") {
      return;
    }

    const nextKey = getVNodeKey(patch.node);
    if (!nextKey) {
      return;
    }

    keyBadges.set(formatPath(patch.path), {
      label: `키:${nextKey}`,
      status: "new",
      tooltip: `새 keyed 노드 "${nextKey}"가 이 위치에 생성되었습니다.`,
    });
  });

  return keyBadges;
}

function getPatchTargetPath(patch) {
  if (patch.type === "TEXT" || patch.type === "REMOVE") {
    return patch.path.slice(0, -1);
  }

  return patch.path;
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
      domNode.dataset.diffBadge = PATCH_LABELS_KO[primaryType] || primaryType;
      tooltipParts.push(`Diff 케이스: ${orderedTypes.map((type) => PATCH_LABELS_KO[type] || type).join(", ")}`);
      tooltipParts.push(...annotation.messages);
    }

    if (keyBadge) {
      domNode.dataset.keyVisualState = keyBadge.status;
      domNode.dataset.keyBadge = keyBadge.label;
      tooltipParts.push(keyBadge.tooltip);
    }

    if (tooltipParts.length > 0) {
      domNode.title = [...new Set(tooltipParts)].join("\n");
    }
  }

  const domChildren = Array.from(domNode.childNodes);
  (vnode.children || []).forEach((childVNode, index) => {
    walkAnnotatedDom(domChildren[index], childVNode, [...path, index], surfaceState);
  });
}

function clearSurfaceAnnotations(rootElement) {
  rootElement.querySelectorAll("[data-diff-visual-state], [data-key-visual-state]").forEach((element) => {
    element.removeAttribute("data-diff-visual-state");
    element.removeAttribute("data-diff-badge");
    element.removeAttribute("data-key-visual-state");
    element.removeAttribute("data-key-badge");
    element.removeAttribute("title");
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

function toggleTextVariant(vdom, key, variantA, variantB) {
  let nextText = variantA;

  updateNodeByKey(vdom, key, (node) => {
    const currentText = getNodeText(node);
    nextText = currentText === variantA ? variantB : variantA;
    node.children = [createTextVNode(nextText)];
  });

  return nextText;
}

function toggleNodeProp(vdom, key, propName, propValue) {
  let enabled = false;

  updateNodeByKey(vdom, key, (node) => {
    const props = { ...(node.props || {}) };
    if (props[propName] === propValue) {
      delete props[propName];
      enabled = false;
    } else {
      props[propName] = propValue;
      enabled = true;
    }
    node.props = props;
  });

  return enabled;
}

function appendListItem(vdom, listKey, item) {
  updateNodeByKey(vdom, listKey, (node) => {
    node.children = [
      ...(node.children || []),
      createElementVNode("li", { "data-key": item.key }, [createTextVNode(item.text)]),
    ];
  });
}

function removeOneListItem(vdom, listKey) {
  const listNode = findNodeByKey(vdom, listKey);
  if (!listNode || !Array.isArray(listNode.children) || listNode.children.length === 0) {
    return null;
  }

  const candidates = listNode.children
    .map((child, index) => ({ child, index, key: getVNodeKey(child) }))
    .filter((entry) => entry.key);

  if (candidates.length <= 1) {
    return null;
  }

  const preferred = candidates.find((entry) => entry.key?.startsWith("history-")) || candidates.find((entry) => entry.key === "diff") || candidates.at(-1);
  listNode.children.splice(preferred.index, 1);
  return preferred.key;
}

function replaceCalloutNode(vdom, key) {
  let nextTag = "p";

  replaceNodeByKey(vdom, key, (node) => {
    nextTag = node.tagName === "blockquote" ? "p" : "blockquote";
    const nextClass = nextTag === "blockquote" ? "doc-block doc-block--callout" : "doc-block doc-block--paragraph";
    return createElementVNode(nextTag, { "data-key": key, class: nextClass }, [createTextVNode(getNodeText(node))]);
  });

  return nextTag;
}

function getNextHistoryKey(vdom, listKey) {
  const listNode = findNodeByKey(vdom, listKey);
  const currentIndexes = new Set(
    (listNode?.children || [])
      .map((child) => getVNodeKey(child))
      .filter((key) => /^history-\d+$/.test(key))
      .map((key) => Number(key.split("-").at(-1))),
  );

  let nextIndex = 1;
  while (currentIndexes.has(nextIndex)) {
    nextIndex += 1;
  }

  return `history-${nextIndex}`;
}

function updateNodeByKey(vnode, key, updater) {
  if (!vnode) {
    return false;
  }

  if (vnode.type === ROOT_NODE) {
    return vnode.children.some((child) => updateNodeByKey(child, key, updater));
  }

  if (vnode.type === TEXT_NODE) {
    return false;
  }

  if (getVNodeKey(vnode) === key) {
    updater(vnode);
    return true;
  }

  return (vnode.children || []).some((child) => updateNodeByKey(child, key, updater));
}

function replaceNodeByKey(vnode, key, replacer) {
  if (!vnode || vnode.type === TEXT_NODE) {
    return false;
  }

  const children = vnode.type === ROOT_NODE ? vnode.children : vnode.children || [];

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];

    if (child?.type !== TEXT_NODE && getVNodeKey(child) === key) {
      children[index] = replacer(child);
      return true;
    }

    if (replaceNodeByKey(child, key, replacer)) {
      return true;
    }
  }

  return false;
}

function findNodeByKey(vnode, key) {
  if (!vnode || vnode.type === TEXT_NODE) {
    return null;
  }

  if (vnode.type !== ROOT_NODE && getVNodeKey(vnode) === key) {
    return vnode;
  }

  for (const child of vnode.children || []) {
    const found = findNodeByKey(child, key);
    if (found) {
      return found;
    }
  }

  return null;
}

function getVNodeAtPath(vnode, path = []) {
  return path.reduce((currentNode, segment) => {
    if (!currentNode) {
      return null;
    }

    if (isKeySegment(segment)) {
      return (currentNode.children || []).find((child) => getVNodeKey(child) === String(segment.value)) ?? null;
    }

    return currentNode.children?.[segment] ?? null;
  }, vnode);
}

function getNodeText(vnode) {
  if (!vnode) {
    return "";
  }

  if (vnode.type === TEXT_NODE) {
    return vnode.value;
  }

  return (vnode.children || [])
    .map((child) => getNodeText(child))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatVNodeSummary(vnode) {
  if (!vnode) {
    return "노드";
  }

  if (vnode.type === TEXT_NODE) {
    return `"${truncateText(vnode.value, 56)}"`;
  }

  const key = getVNodeKey(vnode);
  const text = getNodeText(vnode);
  return `<${vnode.tagName}${key ? ` key="${key}"` : ""}> ${truncateText(text, 56)}`.trim();
}

function describePatchKo(patch) {
  const location = formatPath(patch.path);

  switch (patch.type) {
    case "TEXT":
      return `${location}: 텍스트를 "${truncateText(patch.value, 48)}"(으)로 변경`;
    case "PROPS":
      return `${location}: 속성 ${Object.keys(patch.props || {}).join(", ")} 변경`;
    case "REPLACE":
      return `${location}: 노드를 ${patch.node?.tagName || patch.node?.type || "새 노드"}(으)로 교체`;
    case "REMOVE":
      return `${location}: 노드 삭제`;
    case "CREATE":
      return `${location}: 새 노드 생성`;
    case "REORDER":
      return `${location}: keyed 자식 순서 변경`;
    default:
      return `${location}: ${patch.type}`;
  }
}

function truncateText(value = "", maxLength = 56) {
  const normalized = String(value).replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3)}...`;
}

function formatNullable(value) {
  return value === null || value === undefined ? "없음" : String(value);
}

// TODO: Add an optional REORDER bonus scenario if keyed move visualization needs to be demonstrated separately.
