export const ROOT_NODE = "ROOT";
export const TEXT_NODE = "TEXT";

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

// TODO: keyed diff, component 단위 추상화가 필요해지면 이 파일에 공통 도우미를 더 추가합니다.
