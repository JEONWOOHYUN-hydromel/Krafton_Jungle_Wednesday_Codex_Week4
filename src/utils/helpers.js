export const ROOT_NODE = "ROOT";
export const TEXT_NODE = "TEXT";
export const KEY_SEGMENT = "KEY_SEGMENT";

const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

export function createRootVNode(children = []) {
  return {
    type: ROOT_NODE,
    children,
  };
}

export function createElementVNode(tagName, props = {}, children = []) {
  return {
    type: "ELEMENT",
    tagName,
    props,
    children,
    key: getNormalizedKey(props),
  };
}

export function createTextVNode(value = "") {
  return {
    type: TEXT_NODE,
    value,
  };
}

export function cloneVdom(vnode) {
  return JSON.parse(JSON.stringify(vnode));
}

export function attributesToObject(element) {
  return Array.from(element.attributes).reduce((props, attribute) => {
    props[attribute.name] = attribute.value;
    return props;
  }, {});
}

export function getNormalizedKey(source = {}) {
  const candidate = source.key ?? source["data-key"] ?? null;

  if (candidate === null || candidate === undefined || candidate === "") {
    return null;
  }

  return String(candidate);
}

export function getVNodeKey(vnode) {
  if (!vnode || vnode.type === ROOT_NODE || vnode.type === TEXT_NODE) {
    return null;
  }

  return vnode.key ?? getNormalizedKey(vnode.props);
}

export function getDomNodeKey(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  return getNormalizedKey({
    key: node.getAttribute("key"),
    "data-key": node.getAttribute("data-key"),
  });
}

export function createKeySegment(value) {
  return {
    kind: KEY_SEGMENT,
    value: String(value),
  };
}

export function isKeySegment(segment) {
  return Boolean(segment) && typeof segment === "object" && segment.kind === KEY_SEGMENT;
}

export function diffProps(oldProps = {}, newProps = {}) {
  const propNames = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);
  const changes = {};

  propNames.forEach((name) => {
    if (oldProps[name] !== newProps[name]) {
      changes[name] = newProps[name] ?? null;
    }
  });

  return changes;
}

export function isEmptyObject(value) {
  return Object.keys(value).length === 0;
}

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function escapeAttribute(value = "") {
  return escapeHtml(value).replaceAll('"', "&quot;");
}

export function vdomToHtml(vnode) {
  if (!vnode) {
    return "";
  }

  if (vnode.type === TEXT_NODE) {
    return escapeHtml(vnode.value);
  }

  if (vnode.type === ROOT_NODE) {
    return vnode.children.map(vdomToHtml).join("\n");
  }

  const attrs = Object.entries(vnode.props || {})
    .map(([name, value]) => `${name}="${escapeAttribute(value)}"`)
    .join(" ");

  const openingTag = attrs ? `<${vnode.tagName} ${attrs}>` : `<${vnode.tagName}>`;

  if (VOID_ELEMENTS.has(vnode.tagName)) {
    return openingTag;
  }

  const childrenHtml = (vnode.children || []).map(vdomToHtml).join("");
  return `${openingTag}${childrenHtml}</${vnode.tagName}>`;
}

export function rootToHtml(rootVNode) {
  return vdomToHtml(rootVNode);
}

export function formatPath(path = []) {
  if (path.length === 0) {
    return "root";
  }

  return [
    "root",
    ...path.map((segment) => (isKeySegment(segment) ? `key(${segment.value})` : `[${segment}]`)),
  ].join(" > ");
}

export function createScopedKeyId(path = [], key = "") {
  return `${formatPath(path.slice(0, -1))}::${String(key)}`;
}

export function summarizePatches(patches = []) {
  if (patches.length === 0) {
    return "No changes";
  }

  const counts = patches.reduce((summary, patch) => {
    summary[patch.type] = (summary[patch.type] || 0) + 1;
    return summary;
  }, {});

  return Object.entries(counts)
    .map(([type, count]) => `${type} ${count}`)
    .join(" | ");
}

export function describePatch(patch) {
  const location = formatPath(patch.path);

  switch (patch.type) {
    case "TEXT":
      return `${location}: update text to "${truncateText(patch.value, 48)}"`;
    case "PROPS":
      return `${location}: update props ${Object.keys(patch.props || {}).join(", ")}`;
    case "REPLACE":
      return `${location}: replace node with ${patch.node?.tagName || patch.node?.type || "node"}`;
    case "REMOVE":
      return `${location}: remove node`;
    case "CREATE":
      return `${location}: create node`;
    case "REORDER":
      return `${location}: reorder keyed children`;
    default:
      return `${location}: ${patch.type}`;
  }
}

export function getVdomStats(vnode) {
  const stats = {
    nodes: 0,
    elements: 0,
    texts: 0,
    maxDepth: 0,
  };

  visitVdom(vnode, 0, (node, depth) => {
    stats.nodes += 1;
    stats.maxDepth = Math.max(stats.maxDepth, depth);

    if (node.type === TEXT_NODE) {
      stats.texts += 1;
      return;
    }

    if (node.type !== ROOT_NODE) {
      stats.elements += 1;
    }
  });

  return stats;
}

export function vdomToTreeString(vnode) {
  const lines = [];

  walkTree(vnode, 0, lines);
  return lines.join("\n");
}

export function buildKeyReport(baseVdom, previewVdom) {
  const baseEntries = collectKeyEntries(baseVdom);
  const previewEntries = collectKeyEntries(previewVdom);
  const baseMap = new Map(baseEntries.map((entry) => [entry.id, entry]));
  const previewMap = new Map(previewEntries.map((entry) => [entry.id, entry]));
  const previewStatusById = new Map();
  const preserved = [];
  const moved = [];
  const added = [];
  const removed = [];

  previewEntries.forEach((entry) => {
    const previous = baseMap.get(entry.id);

    if (!previous) {
      added.push(entry);
      previewStatusById.set(entry.id, "added");
      return;
    }

    if (previous.pathLabel !== entry.pathLabel) {
      moved.push({
        ...entry,
        fromPathLabel: previous.pathLabel,
        toPathLabel: entry.pathLabel,
      });
      previewStatusById.set(entry.id, "moved");
      return;
    }

    preserved.push(entry);
    previewStatusById.set(entry.id, "preserved");
  });

  baseEntries.forEach((entry) => {
    if (!previewMap.has(entry.id)) {
      removed.push(entry);
    }
  });

  return {
    preserved,
    moved,
    added,
    removed,
    previewStatusById,
    summary: {
      actualKeys: baseEntries.length,
      previewKeys: previewEntries.length,
      preserved: preserved.length,
      moved: moved.length,
      added: added.length,
      removed: removed.length,
    },
  };
}

function walkTree(vnode, depth, lines) {
  const indent = "  ".repeat(depth);

  if (!vnode) {
    lines.push(`${indent}- null`);
    return;
  }

  if (vnode.type === ROOT_NODE) {
    lines.push("ROOT");
    vnode.children.forEach((child) => {
      walkTree(child, depth + 1, lines);
    });
    return;
  }

  if (vnode.type === TEXT_NODE) {
    lines.push(`${indent}- "${truncateText(normalizeText(vnode.value), 56)}"`);
    return;
  }

  const attrs = Object.entries(vnode.props || {})
    .map(([name, value]) => `${name}="${truncateText(String(value), 24)}"`)
    .join(" ");

  lines.push(`${indent}- <${vnode.tagName}${attrs ? ` ${attrs}` : ""}>`);

  if ((vnode.children || []).length === 0) {
    lines.push(`${indent}  - (empty)`);
    return;
  }

  vnode.children.forEach((child) => {
    walkTree(child, depth + 1, lines);
  });
}

function collectKeyEntries(vnode, path = [], entries = []) {
  if (!vnode) {
    return entries;
  }

  if (vnode.type === ROOT_NODE) {
    vnode.children.forEach((child, index) => {
      collectKeyEntries(child, [...path, index], entries);
    });
    return entries;
  }

  if (vnode.type === TEXT_NODE) {
    return entries;
  }

  const key = getVNodeKey(vnode);
  if (key !== null) {
    entries.push({
      id: createScopedKeyId(path, key),
      key,
      tagName: vnode.tagName,
      pathLabel: formatPath(path),
      scopeLabel: formatPath(path.slice(0, -1)),
    });
  }

  (vnode.children || []).forEach((child, index) => {
    collectKeyEntries(child, [...path, index], entries);
  });

  return entries;
}

function visitVdom(vnode, depth, visitor) {
  if (!vnode) {
    return;
  }

  visitor(vnode, depth);

  (vnode.children || []).forEach((child) => {
    visitVdom(child, depth + 1, visitor);
  });
}

function normalizeText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function truncateText(value = "", maxLength = 32) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

// TODO: If component-level scheduling is added later, keep shared formatter helpers here.
