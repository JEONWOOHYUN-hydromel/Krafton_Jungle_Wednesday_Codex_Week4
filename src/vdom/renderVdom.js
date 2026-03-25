import { ROOT_NODE, TEXT_NODE } from "../utils/helpers.js";

export function renderVdom(vnode) {
  if (!vnode) {
    return document.createTextNode("");
  }

  if (vnode.type === TEXT_NODE) {
    return document.createTextNode(vnode.value);
  }

  if (vnode.type === ROOT_NODE) {
    const fragment = document.createDocumentFragment();
    vnode.children.forEach((child) => {
      fragment.appendChild(renderVdom(child));
    });
    return fragment;
  }

  const element = document.createElement(vnode.tagName);

  Object.entries(vnode.props || {}).forEach(([name, value]) => {
    element.setAttribute(name, value);
  });

  (vnode.children || []).forEach((child) => {
    element.appendChild(renderVdom(child));
  });

  return element;
}

export function mountVdom(container, rootVNode) {
  container.replaceChildren();

  if (!rootVNode) {
    return;
  }

  if (rootVNode.type === ROOT_NODE) {
    rootVNode.children.forEach((child) => {
      container.appendChild(renderVdom(child));
    });
    return;
  }

  container.appendChild(renderVdom(rootVNode));
}

// TODO: 이후 성능 최적화가 필요하면 DocumentFragment 재사용 전략을 추가합니다.
