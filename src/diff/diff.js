import { ROOT_NODE, TEXT_NODE, diffProps, isEmptyObject } from "../utils/helpers.js";

export const PATCH_TYPES = {
  CREATE: "CREATE",
  REMOVE: "REMOVE",
  REPLACE: "REPLACE",
  TEXT: "TEXT",
  PROPS: "PROPS",
};

export function diff(oldVNode, newVNode) {
  const patches = [];
  walk(oldVNode, newVNode, [], patches);
  return patches;
}

function walk(oldVNode, newVNode, path, patches) {
  if (!oldVNode && !newVNode) {
    return;
  }

  if (!oldVNode) {
    patches.push({
      type: PATCH_TYPES.CREATE,
      path,
      node: newVNode,
    });
    return;
  }

  if (!newVNode) {
    patches.push({
      type: PATCH_TYPES.REMOVE,
      path,
    });
    return;
  }

  if (oldVNode.type === ROOT_NODE || newVNode.type === ROOT_NODE) {
    const oldChildren = oldVNode.children || [];
    const newChildren = newVNode.children || [];
    const maxLength = Math.max(oldChildren.length, newChildren.length);

    for (let index = 0; index < maxLength; index += 1) {
      walk(oldChildren[index], newChildren[index], [...path, index], patches);
    }

    return;
  }

  if (oldVNode.type !== newVNode.type) {
    patches.push({
      type: PATCH_TYPES.REPLACE,
      path,
      node: newVNode,
    });
    return;
  }

  if (oldVNode.type === TEXT_NODE && newVNode.type === TEXT_NODE) {
    if (oldVNode.value !== newVNode.value) {
      patches.push({
        type: PATCH_TYPES.TEXT,
        path,
        value: newVNode.value,
      });
    }

    return;
  }

  if (oldVNode.tagName !== newVNode.tagName) {
    patches.push({
      type: PATCH_TYPES.REPLACE,
      path,
      node: newVNode,
    });
    return;
  }

  const propChanges = diffProps(oldVNode.props, newVNode.props);
  if (!isEmptyObject(propChanges)) {
    patches.push({
      type: PATCH_TYPES.PROPS,
      path,
      props: propChanges,
    });
  }

  const oldChildren = oldVNode.children || [];
  const newChildren = newVNode.children || [];
  const maxLength = Math.max(oldChildren.length, newChildren.length);

  for (let index = 0; index < maxLength; index += 1) {
    walk(oldChildren[index], newChildren[index], [...path, index], patches);
  }
}

// TODO: 현재는 index 기반 비교입니다. 추후 key 기반 최소 변경 탐지로 확장할 수 있습니다.
