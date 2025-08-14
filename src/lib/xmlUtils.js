/**
 * Removes invalid XML characters from a string.
 * @param {string} xmlString The raw XML string.
 * @returns {{cleaned: string, removedCount: number}} The cleaned string and count of removed characters.
 */
export function cleanXML(xmlString) {
  // eslint-disable-next-line no-control-regex
  const invalidCharRegex = /[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu;
  let removedCount = 0;
  const cleaned = xmlString.replace(invalidCharRegex, () => {
    removedCount++;
    return '';
  });
  return { cleaned, removedCount };
}

/**
 * Parses an XML string into a structured JavaScript object.
 * @param {string} xmlString A clean XML string.
 * @returns {{doc: object, rootName: string}} The parsed document and the name of the root element.
 */
export function parseXML(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');
  const errorNode = doc.querySelector('parsererror');
  if (errorNode) {
    throw new Error(`XML Parsing Error: ${errorNode.innerText}`);
  }
  const rootElement = doc.documentElement;
  return {
    doc: xmlToJson(rootElement),
    rootName: rootElement.nodeName,
  };
}

function xmlToJson(node) {
  if (node.nodeType === 3) { // Text node
    return node.nodeValue.trim() ? node.nodeValue.trim() : null;
  }
  if (node.nodeType !== 1) { // Element node
    return null;
  }

  let obj = {};

  // Group children by tag name
  const childrenByName = {};
  for (const child of node.childNodes) {
    if (child.nodeType === 1) { // Element nodes only
        if (!childrenByName[child.nodeName]) {
            childrenByName[child.nodeName] = [];
        }
        childrenByName[child.nodeName].push(child);
    }
  }

  // Handle text-only nodes
  const childElementCount = Object.keys(childrenByName).length;
  const hasTextContent = node.childNodes.length > 0 && Array.from(node.childNodes).some(n => n.nodeType === 3 && n.nodeValue.trim());

  if (childElementCount === 0 && hasTextContent) {
    return node.textContent.trim();
  }


  for(const name in childrenByName) {
      const children = childrenByName[name];
      const parsedChildren = children.map(xmlToJson).filter(c => c !== null);
      if(parsedChildren.length > 0) {
        obj[name] = parsedChildren.length === 1 ? parsedChildren[0] : parsedChildren;
      }
  }

  return obj;
}


/**
 * Converts a JavaScript object back to an XML string.
 * @param {object} obj The JS object.
 * @param {string} rootName The name of the root XML element.
 * @returns {string} The XML string.
 */
export function jsonToXml(obj, rootName) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  
  const toXml = (data, tagName) => {
    if (data === null || data === undefined) return '';
    
    let content = '';
    if (Array.isArray(data)) {
      data.forEach(item => {
        content += toXml(item, tagName);
      });
      return content;
    }
    
    content += `<${tagName}>`;
    if (typeof data === 'object') {
      for (const key in data) {
        content += toXml(data[key], key);
      }
    } else {
      content += String(data).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    }
    content += `</${tagName}>`;
    return content;
  }

  xml += toXml(obj, rootName);
  return xml;
}
