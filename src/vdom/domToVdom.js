import {
  ROOT_NODE,
  TEXT_NODE,
  attributesToObject,
  createElementVNode,
  createRootVNode,
  createTextVNode,
} from "../utils/helpers.js";

export function domToVdom(node) {
  if (!node) {
    return null;
  }

  if (node.nodeType === Node.TEXT_NODE) {
    if (node.textContent.trim() === "") {
      return null;
    }

    return createTextVNode(node.textContent);
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const children = Array.from(node.childNodes).map(domToVdom).filter(Boolean);
  return createElementVNode(node.tagName.toLowerCase(), attributesToObject(node), children);
}

export function domChildrenToVdom(container) {
  const children = Array.from(container.childNodes).map(domToVdom).filter(Boolean);
  return createRootVNode(children);
}

export function htmlToVdom(html = "") {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return domChildrenToVdom(template.content);
}

export function isRootVNode(vnode) {
  return vnode?.type === ROOT_NODE;
}

export function isTextVNode(vnode) {
  return vnode?.type === TEXT_NODE;
}

// TODO: style/class/dataset 같은 속성을 더 세밀하게 분리해서 저장하고 싶다면 여기서 확장합니다.
