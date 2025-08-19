import React from 'react';
import useStore from '../lib/store';
import EditableCell from './EditableCell';
import get from 'lodash.get';

export default function ValueRenderer({ value, path }) {
  const { setViewingNodePath, setNodeForColumnSelection } = useStore.getState();
  const viewingNodePath = useStore.use.viewingNodePath();

  const handleViewObject = (e) => {
    e.stopPropagation();
    setViewingNodePath(path);
  };

  const handleExpand = (e) => {
    e.stopPropagation();
    const isInsideTable = !!viewingNodePath && Array.isArray(get(useStore.getState().xmlDoc.doc, viewingNodePath));
    // Pass the current table's path as the parent path for both arrays and objects
    setNodeForColumnSelection(path, isInsideTable ? viewingNodePath : null);
  };

  if (value === undefined || value === null) {
    // Render an empty editable cell, so users can add a value if needed
    return <EditableCell value="" path={path} />;
  }

  if (Array.isArray(value)) {
    return (
      <button className="data-action-btn" onClick={handleExpand}>
        <span className="icon">table_rows</span>
        View Table ({value.length})
      </button>
    );
  }

  if (typeof value === 'object' && value !== null) {
    // We can only expand/merge if we are currently inside a table view.
    const isInsideTable = !!viewingNodePath && Array.isArray(get(useStore.getState().xmlDoc.doc, viewingNodePath));
    return (
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button className="data-action-btn" onClick={handleViewObject}>
          <span className="icon">data_object</span>
          View Object
        </button>
        {isInsideTable && (
           <button className="data-action-btn" title="Expand columns into parent table" onClick={handleExpand}>
            <span className="icon">unfold_more</span>
            Expand
          </button>
        )}
      </div>
    );
  }

  // For primitive values (string, number, boolean)
  return <EditableCell value={value} path={path} />;
}