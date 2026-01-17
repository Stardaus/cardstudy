/**
 * Simple DOM selector helper.
 * @param {string} selector - CSS selector string.
 * @param {Element|Document} [parent=document] - Parent element to search within.
 * @returns {Element|null} The first matching element, or null.
 */
export function $(selector, parent = document) {
  return parent.querySelector(selector);
}

/**
 * Simple DOM all selector helper.
 * @param {string} selector - CSS selector string.
 * @param {Element|Document} [parent=document] - Parent element to search within.
 * @returns {NodeListOf<Element>} All matching elements.
 */
export function $$(selector, parent = document) {
  return parent.querySelectorAll(selector);
}

/**
 * Creates a new DOM element with optional attributes and children.
 * @param {string} tagName - The tag name of the element to create.
 * @param {Object} [attributes={}] - Object of attributes to set on the element.
 * @param {Array<Node|string>} [children=[]] - Array of child nodes or strings to append.
 * @returns {HTMLElement} The created element.
 */
export function createElement(tagName, attributes = {}, children = []) {
  const element = document.createElement(tagName);
  for (const key in attributes) {
    if (attributes.hasOwnProperty(key)) {
      element.setAttribute(key, attributes[key]);
    }
  }
  children.forEach(child => {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else {
      element.appendChild(child);
    }
  });
  return element;
}
