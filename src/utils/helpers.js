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

export function hasVNodeKey(vnode) {
  return getVNodeKey(vnode) !== null;
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

export function summarizePatches(patches = []) {
  if (patches.length === 0) {
    return "변경점이 없습니다.";
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
      return `${location}: 텍스트를 "${patch.value}" 로 변경`;
    case "PROPS":
      return `${location}: 속성 변경 ${Object.keys(patch.props || {}).join(", ")}`;
    case "REPLACE":
      return `${location}: 노드를 ${patch.node?.tagName || patch.node?.type || "새 노드"}로 교체`;
    case "REMOVE":
      return `${location}: 노드 제거`;
    case "CREATE":
      return `${location}: 새 노드 추가`;
    case "REORDER":
      return `${location}: keyed 자식 순서/구성 재정렬`;
    default:
      return `${location}: ${patch.type}`;
  }
}

// TODO: component 단위 추상화나 scheduler 실험이 필요해지면 공통 유틸을 이 파일에 추가합니다.
