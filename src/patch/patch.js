import { PATCH_TYPES } from "../diff/diff.js";
import { getDomNodeKey, getVNodeKey, isKeySegment } from "../utils/helpers.js";
import { renderVdom } from "../vdom/renderVdom.js";

export function applyPatches(rootElement, patches = []) {
  const orderedPatches = sortPatches(patches);
  const changedNodes = [];

  orderedPatches.forEach((patch) => {
    const result = applyPatch(rootElement, patch);

    if (Array.isArray(result)) {
      changedNodes.push(...result);
      return;
    }

    if (result) {
      changedNodes.push(result);
    }
  });

  return normalizeHighlightTargets(changedNodes);
}

function applyPatch(rootElement, patch) {
  switch (patch.type) {
    case PATCH_TYPES.TEXT:
      return updateText(rootElement, patch);
    case PATCH_TYPES.PROPS:
      return updateProps(rootElement, patch);
    case PATCH_TYPES.REPLACE:
      return replaceNode(rootElement, patch);
    case PATCH_TYPES.REMOVE:
      return removeNode(rootElement, patch);
    case PATCH_TYPES.CREATE:
      return createNode(rootElement, patch);
    case PATCH_TYPES.REORDER:
      return reorderChildren(rootElement, patch);
    default:
      return null;
  }
}

function updateText(rootElement, patch) {
  const target = getNodeByPath(rootElement, patch.path);
  if (!target) {
    return null;
  }

  target.textContent = patch.value;
  return target;
}

function updateProps(rootElement, patch) {
  const target = getNodeByPath(rootElement, patch.path);
  if (!target || target.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  Object.entries(patch.props || {}).forEach(([name, value]) => {
    if (value === null) {
      target.removeAttribute(name);
      return;
    }

    target.setAttribute(name, value);
  });

  return target;
}

function replaceNode(rootElement, patch) {
  const target = getNodeByPath(rootElement, patch.path);
  if (!target || !target.parentNode) {
    return null;
  }

  const nextNode = renderVdom(patch.node);
  target.parentNode.replaceChild(nextNode, target);
  return nextNode;
}

function removeNode(rootElement, patch) {
  const target = getNodeByPath(rootElement, patch.path);
  if (!target || !target.parentNode) {
    return null;
  }

  const highlightTarget = target.parentNode;
  target.parentNode.removeChild(target);
  return highlightTarget;
}

function createNode(rootElement, patch) {
  const parentPath = patch.path.slice(0, -1);
  const insertIndex = patch.path.at(-1);
  const parent = getNodeByPath(rootElement, parentPath);

  if (!parent || typeof insertIndex !== "number") {
    return null;
  }

  const nextNode = renderVdom(patch.node);
  const referenceNode = parent.childNodes[insertIndex] ?? null;
  parent.insertBefore(nextNode, referenceNode);
  return nextNode;
}

function reorderChildren(rootElement, patch) {
  const parent = getNodeByPath(rootElement, patch.path);

  if (!parent) {
    return null;
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
  return [parent, ...nextChildNodes];
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

function normalizeHighlightTargets(nodes) {
  const uniqueTargets = [];
  const seenNodes = new Set();

  nodes.forEach((node) => {
    const target = toHighlightElement(node);

    if (!target || !target.isConnected || seenNodes.has(target)) {
      return;
    }

    seenNodes.add(target);
    uniqueTargets.push(target);
  });

  return uniqueTargets;
}

function toHighlightElement(node) {
  if (!node) {
    return null;
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    return node;
  }

  if (node.nodeType === Node.TEXT_NODE) {
    return node.parentElement;
  }

  return null;
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

// TODO: Preserve focus or selection state if the demo grows into richer editing.
