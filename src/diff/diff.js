import {
  ROOT_NODE,
  TEXT_NODE,
  createKeySegment,
  diffProps,
  getVNodeKey,
  isEmptyObject,
} from "../utils/helpers.js";

export const PATCH_TYPES = {
  CREATE: "CREATE",
  REMOVE: "REMOVE",
  REPLACE: "REPLACE",
  TEXT: "TEXT",
  PROPS: "PROPS",
  REORDER: "REORDER",
};

export const DIFF_MODES = {
  AUTO: "auto",
  INDEX: "index",
};

export function diff(oldVNode, newVNode, options = {}) {
  const patches = [];
  const normalizedOptions = {
    mode: DIFF_MODES.AUTO,
    ...options,
  };

  walk(oldVNode, newVNode, [], patches, normalizedOptions);
  return patches;
}

function walk(oldVNode, newVNode, path, patches, options) {
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

  if (oldVNode.type !== ROOT_NODE && oldVNode.tagName !== newVNode.tagName) {
    patches.push({
      type: PATCH_TYPES.REPLACE,
      path,
      node: newVNode,
    });
    return;
  }

  if (oldVNode.type !== ROOT_NODE && getVNodeKey(oldVNode) !== getVNodeKey(newVNode)) {
    patches.push({
      type: PATCH_TYPES.REPLACE,
      path,
      node: newVNode,
    });
    return;
  }

  if (oldVNode.type !== ROOT_NODE) {
    const propChanges = diffProps(oldVNode.props, newVNode.props);
    if (!isEmptyObject(propChanges)) {
      patches.push({
        type: PATCH_TYPES.PROPS,
        path,
        props: propChanges,
      });
    }
  }

  diffChildren(oldVNode.children || [], newVNode.children || [], path, patches, options);
}

function diffChildren(oldChildren, newChildren, parentPath, patches, options) {
  if (options.mode !== DIFF_MODES.INDEX && shouldUseKeyedDiff(oldChildren, newChildren)) {
    diffKeyedChildren(oldChildren, newChildren, parentPath, patches, options);
    return;
  }

  const maxLength = Math.max(oldChildren.length, newChildren.length);

  for (let index = 0; index < maxLength; index += 1) {
    walk(oldChildren[index], newChildren[index], [...parentPath, index], patches, options);
  }
}

function diffKeyedChildren(oldChildren, newChildren, parentPath, patches, options) {
  const oldKeys = oldChildren.map(getVNodeKey);
  const newKeys = newChildren.map(getVNodeKey);

  if (hasKeyOrderChanged(oldKeys, newKeys)) {
    patches.push({
      type: PATCH_TYPES.REORDER,
      path: parentPath,
      children: newChildren,
    });
  }

  const oldChildrenByKey = new Map(oldChildren.map((child) => [getVNodeKey(child), child]));

  newChildren.forEach((newChild) => {
    const key = getVNodeKey(newChild);
    const oldChild = oldChildrenByKey.get(key);

    if (!oldChild) {
      return;
    }

    walk(oldChild, newChild, [...parentPath, createKeySegment(key)], patches, options);
  });
}

function shouldUseKeyedDiff(oldChildren, newChildren) {
  if (oldChildren.length === 0 && newChildren.length === 0) {
    return false;
  }

  return areChildrenKeyedAndUnique(oldChildren) && areChildrenKeyedAndUnique(newChildren);
}

function areChildrenKeyedAndUnique(children) {
  const seenKeys = new Set();

  for (const child of children) {
    if (!child) {
      return false;
    }

    if (child.type === TEXT_NODE) {
      return false;
    }

    const key = getVNodeKey(child);
    if (key === null || seenKeys.has(key)) {
      return false;
    }

    seenKeys.add(key);
  }

  return true;
}

function hasKeyOrderChanged(oldKeys, newKeys) {
  if (oldKeys.length !== newKeys.length) {
    return true;
  }

  return oldKeys.some((key, index) => key !== newKeys[index]);
}

// TODO: Mixed keyed and unkeyed siblings still fall back to index diff.
