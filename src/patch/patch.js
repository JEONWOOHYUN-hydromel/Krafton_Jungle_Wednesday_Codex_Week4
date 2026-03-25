import { PATCH_TYPES } from "../diff/diff.js";
import { getDomNodeKey, getVNodeKey, isKeySegment } from "../utils/helpers.js";
import { renderVdom } from "../vdom/renderVdom.js";

export function applyPatches(rootElement, patches = []) {
  const orderedPatches = sortPatches(patches);
  orderedPatches.forEach((patch) => {
    applyPatch(rootElement, patch);
  });
}

function applyPatch(rootElement, patch) {
  switch (patch.type) {
    case PATCH_TYPES.TEXT:
      updateText(rootElement, patch);
      break;
    case PATCH_TYPES.PROPS:
      updateProps(rootElement, patch);
      break;
    case PATCH_TYPES.REPLACE:
      replaceNode(rootElement, patch);
      break;
    case PATCH_TYPES.REMOVE:
      removeNode(rootElement, patch);
      break;
    case PATCH_TYPES.CREATE:
      createNode(rootElement, patch);
      break;
    case PATCH_TYPES.REORDER:
      reorderChildren(rootElement, patch);
      break;
    default:
      break;
  }
}

function updateText(rootElement, patch) {
  const target = getNodeByPath(rootElement, patch.path);
  if (target) {
    target.textContent = patch.value;
  }
}

function updateProps(rootElement, patch) {
  const target = getNodeByPath(rootElement, patch.path);
  if (!target || target.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  Object.entries(patch.props || {}).forEach(([name, value]) => {
    if (value === null) {
      target.removeAttribute(name);
      return;
    }

    target.setAttribute(name, value);
  });
}

function replaceNode(rootElement, patch) {
  const target = getNodeByPath(rootElement, patch.path);
  if (!target || !target.parentNode) {
    return;
  }

  target.parentNode.replaceChild(renderVdom(patch.node), target);
}

function removeNode(rootElement, patch) {
  const target = getNodeByPath(rootElement, patch.path);
  if (target && target.parentNode) {
    target.parentNode.removeChild(target);
  }
}

function createNode(rootElement, patch) {
  const parentPath = patch.path.slice(0, -1);
  const insertIndex = patch.path.at(-1);
  const parent = getNodeByPath(rootElement, parentPath);

  if (!parent || typeof insertIndex !== "number") {
    return;
  }

  const referenceNode = parent.childNodes[insertIndex] ?? null;
  parent.insertBefore(renderVdom(patch.node), referenceNode);
}

function reorderChildren(rootElement, patch) {
  const parent = getNodeByPath(rootElement, patch.path);

  if (!parent) {
    return;
  }

  const existingChildrenByKey = new Map();

  Array.from(parent.childNodes).forEach((childNode) => {
    const key = getDomNodeKey(childNode);
    if (key !== null) {
      existingChildrenByKey.set(key, childNode);
    }
  });

  const nextChildNodes = (patch.children || []).map((childVNode) => {
    const key = getVNodeKey(childVNode);

    if (key !== null && existingChildrenByKey.has(key)) {
      return existingChildrenByKey.get(key);
    }

    return renderVdom(childVNode);
  });

  parent.replaceChildren(...nextChildNodes);
}

function getNodeByPath(rootElement, path = []) {
  return path.reduce((currentNode, segment) => {
    if (!currentNode) {
      return null;
    }

    if (isKeySegment(segment)) {
      return findChildByKey(currentNode, segment.value);
    }

    return currentNode.childNodes?.[segment] ?? null;
  }, rootElement);
}

function findChildByKey(parentNode, key) {
  return Array.from(parentNode.childNodes).find((childNode) => getDomNodeKey(childNode) === String(key)) ?? null;
}

function sortPatches(patches) {
  const stable = [];
  const removals = [];
  const creations = [];

  patches.forEach((patch) => {
    if (patch.type === PATCH_TYPES.REMOVE) {
      removals.push(patch);
      return;
    }

    if (patch.type === PATCH_TYPES.CREATE) {
      creations.push(patch);
      return;
    }

    stable.push(patch);
  });

  stable.sort((left, right) => comparePath(left.path, right.path));
  removals.sort((left, right) => comparePath(right.path, left.path));
  creations.sort((left, right) => comparePath(left.path, right.path));

  return [...stable, ...removals, ...creations];
}

function comparePath(left = [], right = []) {
  const maxLength = Math.max(left.length, right.length);

  for (let index = 0; index < maxLength; index += 1) {
    const result = compareSegment(left[index], right[index]);

    if (result !== 0) {
      return result;
    }
  }

  return left.length - right.length;
}

function compareSegment(left, right) {
  if (left === undefined) {
    return -1;
  }

  if (right === undefined) {
    return 1;
  }

  if (isKeySegment(left) && isKeySegment(right)) {
    return String(left.value).localeCompare(String(right.value));
  }

  if (isKeySegment(left)) {
    return 1;
  }

  if (isKeySegment(right)) {
    return -1;
  }

  return left - right;
}

// TODO: focus 유지나 selection 복원까지 필요해지면 patch 단계에서 UI 상태 보존 로직을 추가합니다.
