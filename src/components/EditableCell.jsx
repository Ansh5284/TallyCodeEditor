import React, { useEffect, useRef } from 'react';
import useStore from '../lib/store';

export default function EditableCell({ value, path }) {
  const updateNodeValue = useStore.use.updateNodeValue();
  const elementRef = useRef(null);

  // Sync the display value with the store state only when the prop changes.
  useEffect(() => {
    const element = elementRef.current;
    const stringValue = value === null || value === undefined ? '' : String(value);
    if (element && element.innerText !== stringValue) {
      element.innerText = stringValue;
    }
  }, [value]);

  const handleBlur = () => {
    if (elementRef.current) {
      const newValue = elementRef.current.innerText;
      const originalValue = value === null || value === undefined ? '' : String(value);
      if (newValue !== originalValue) {
        // Pass the array path directly to the action
        updateNodeValue(path, newValue);
      }
    }
  };
  
  const handleKeyDown = (e) => {
    // Blur the element on Enter key to save, but allow Shift+Enter for new lines.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.target.blur();
    }
  };

  const initialValue = value === null || value === undefined ? '' : String(value);

  return (
    <div
      ref={elementRef}
      className="editable-cell"
      contentEditable
      suppressContentEditableWarning
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      dangerouslySetInnerHTML={{ __html: initialValue }}
    />
  );
}