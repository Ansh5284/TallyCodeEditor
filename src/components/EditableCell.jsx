import React, { useState, useEffect } from 'react';
import useStore from '../lib/store';

export default function EditableCell({ value, path }) {
  const [currentValue, setCurrentValue] = useState(value);
  const updateNodeValue = useStore.use.updateNodeValue();

  useEffect(() => {
    setCurrentValue(value);
  }, [value]);

  const handleBlur = (e) => {
    const newValue = e.target.innerText;
    if (newValue !== value) {
      updateNodeValue(path, newValue);
    }
  };

  const handleInput = (e) => {
     setCurrentValue(e.target.innerText);
  }
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.target.blur();
    }
  }

  return (
    <div
      className="editable-cell"
      contentEditable
      suppressContentEditableWarning
      onBlur={handleBlur}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
    >
      {currentValue || ''}
    </div>
  );
}
