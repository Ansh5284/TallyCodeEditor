import React, { useState } from 'react';
import useStore from '../lib/store';
import clsx from 'clsx';

function TreeNode({ data, name, path, currentSelection }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const setSelectedNodePath = useStore.use.setSelectedNodePath();

  const isObject = typeof data === 'object' && data !== null && !Array.isArray(data);
  const isArray = Array.isArray(data);

  const handleToggle = (e) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };
  
  const handleSelectTable = (e) => {
    e.stopPropagation();
    setSelectedNodePath(path);
  }

  return (
    <li className="tree-node">
      <div className={clsx("tree-node-label", {selected: currentSelection === path && isArray})} onClick={handleToggle}>
        {isObject && <span className="icon">{isExpanded ? 'expand_more' : 'chevron_right'}</span>}
        <span className="node-name">{name}</span>
        {isArray && (
          <>
            <span className="node-meta">[{data.length} items]</span>
            <button className="view-table-btn" onClick={handleSelectTable}>
              <span className="icon">grid_view</span> View
            </button>
          </>
        )}
      </div>

      {isExpanded && isObject && (
        <ul>
          {Object.entries(data).map(([key, value]) => (
            <TreeNode key={key} name={key} data={value} path={`${path}.${key}`} currentSelection={currentSelection} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function TreeView({ data }) {
  const selectedNodePath = useStore.use.selectedNodePath();
  return (
    <ul style={{ paddingLeft: '0' }}>
      {Object.entries(data).map(([key, value]) => (
        <TreeNode key={key} name={key} data={value} path={key} currentSelection={selectedNodePath} />
      ))}
    </ul>
  );
}
