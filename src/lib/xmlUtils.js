/**
 * Decodes an ArrayBuffer into a string, automatically detecting the
 * encoding (UTF-8, UTF-16LE, UTF-16BE) by checking for a Byte Order Mark (BOM).
 * @param {ArrayBuffer} arrayBuffer The raw file buffer.
 * @returns {string} The decoded string.
 */
export function decodeXML(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let encoding = 'utf-8'; // Default encoding

  if (bytes.length >= 2) {
    if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
      encoding = 'utf-16be'; // Big Endian
    } else if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
      encoding = 'utf-16le'; // Little Endian
    }
  }

  const decoder = new TextDecoder(encoding);
  return decoder.decode(arrayBuffer);
}

/**
 * Removes invalid XML characters from a string and logs the changes.
 * @param {string} xmlString The raw XML string.
 * @returns {{cleaned: string, removedCount: number, log: string[]}} The cleaned string, count of removed characters, and a log of actions.
 */
export function cleanXML(xmlString) {
  const log = [];
  let cleaned = xmlString;

  // Step 1: Remove NUL chars and BOM
  const nulChars = cleaned.match(/\u0000/g) || [];
  if (nulChars.length > 0) {
    log.push(`Removed ${nulChars.length} NUL character(s) (\\u0000), which can cause parsing errors.`);
    cleaned = cleaned.replace(/\u0000/g, '');
  }

  const bomMatch = cleaned.match(/^[\s\uFEFF\uFFFD]+/);
  if (bomMatch) {
    log.push('Removed Byte Order Mark (BOM) from the beginning of the file.');
    cleaned = cleaned.replace(/^[\s\uFEFF\uFFFD]+/, '');
  }
  
  // Step 2: Final cleaning for invalid XML characters
  // eslint-disable-next-line no-control-regex
  const invalidRawCharRegex = /[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu;
  const invalidChars = cleaned.match(invalidRawCharRegex) || [];

  if (invalidChars.length > 0) {
     const uniqueInvalid = [...new Set(invalidChars)];
     const charCodes = uniqueInvalid.map(c => `U+${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`).join(', ');
     log.push(`Removed ${invalidChars.length} invalid control character(s) not allowed in XML. Unique characters found: ${charCodes}.`);
     cleaned = cleaned.replace(invalidRawCharRegex, '');
  }
  
  const removedCount = xmlString.length - cleaned.length;

  return { cleaned, removedCount, log };
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
  if (node.nodeType !== 1) { // Not an Element node
    return null;
  }

  let obj = {};

  // Parse attributes
  if (node.hasAttributes()) {
    obj['@attributes'] = {};
    for (const attr of node.attributes) {
      obj['@attributes'][attr.nodeName] = attr.nodeValue;
    }
  }

  // Group children by tag name and collect text
  const childrenByName = {};
  let textValue = '';
  if (node.hasChildNodes()) {
      for (const child of node.childNodes) {
        if (child.nodeType === 1) { // Element node
          if (!childrenByName[child.nodeName]) {
            childrenByName[child.nodeName] = [];
          }
          childrenByName[child.nodeName].push(child);
        } else if (child.nodeType === 3 && child.nodeValue.trim()) { // Text node
          textValue += child.nodeValue.trim();
        }
      }
  }

  // Parse child elements
  for (const name in childrenByName) {
    const children = childrenByName[name];
    const parsedChildren = children.map(xmlToJson).filter(c => c !== null);
    if (parsedChildren.length > 0) {
      // If there's only one child with this tag name, don't wrap it in an array.
      obj[name] = parsedChildren.length === 1 ? parsedChildren[0] : parsedChildren;
    }
  }
  
  const hasAttributes = Object.keys(obj['@attributes'] || {}).length > 0;
  const hasChildElements = Object.keys(childrenByName).length > 0;

  // Determine final object structure
  if (hasChildElements) {
    if (textValue) {
      obj['#text'] = textValue;
    }
    return obj;
  }

  if (hasAttributes) {
    if (textValue) {
      obj['#text'] = textValue;
    }
    return obj;
  }
  
  // If no attributes and no child elements, it's a text-only node or an empty tag.
  // Return empty string for empty tags to prevent them from being discarded.
  return textValue || '';
}


/**
 * Converts a JavaScript object back to an XML string.
 * @param {object} obj The JS object.
 * @param {string} rootName The name of the root XML element.
 * @returns {string} The XML string.
 */
export function jsonToXml(obj, rootName) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';

  const escapeXml = (str) =>
    String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const toXml = (data, tagName) => {
    if (data === null || data === undefined) return '';

    if (Array.isArray(data)) {
      return data.map(item => toXml(item, tagName)).join('');
    }

    let attributes = '';
    let children = '';
    let textContent = '';

    if (typeof data === 'object' && data !== null) {
      for (const key in data) {
        if (key === '@attributes') {
          for (const attr in data[key]) {
            attributes += ` ${attr}="${escapeXml(data[key][attr])}"`;
          }
        } else if (key === '#text') {
          textContent = escapeXml(data[key]);
        } else {
          children += toXml(data[key], key);
        }
      }
    } else {
      textContent = escapeXml(data);
    }

    if (!children && !textContent) {
      return `<${tagName}${attributes}/>\n`;
    }

    return `<${tagName}${attributes}>${textContent}${children}</${tagName}>\n`;
  };

  xml += toXml(obj[rootName], rootName);
  return xml;
}