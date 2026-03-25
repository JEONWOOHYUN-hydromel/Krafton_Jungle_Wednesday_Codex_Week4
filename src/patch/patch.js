import { renderVdom } from "../vdom/renderVdom.js";
import { PATCH_TYPES } from "../diff/diff.js";

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

  if (!parent) {
    return;
  }

  const referenceNode = parent.childNodes[insertIndex] ?? null;
  parent.insertBefore(renderVdom(patch.node), referenceNode);
}

function getNodeByPath(rootElement, path = []) {
  return path.reduce((currentNode, childIndex) => currentNode?.childNodes?.[childIndex] ?? null, rootElement);
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
    const leftValue = left[index] ?? -1;
    const rightValue = right[index] ?? -1;

    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }
  }

  return left.length - right.length;
}

// TODO: replace / remove / create 이후 focus 유지 같은 세밀한 UX 처리는 이 파일에서 개선합니다.
