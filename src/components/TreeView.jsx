import React, { useState } from 'react';
import useStore from '../lib/store';
import clsx from 'clsx';
import get from 'lodash.get';

const getDisplayName = (defaultName, nodeData) => {
    // If the node is an object in an array (i.e., its key is a number),
    // try to use its NAME attribute for a more descriptive label.
    if (typeof nodeData === 'object' && nodeData !== null && !Array.isArray(nodeData) && !isNaN(parseInt(defaultName, 10))) {
        const attributes = nodeData['@attributes'];
        if (attributes && attributes.NAME) {
            return attributes.NAME;
        }
    }
    return defaultName;
};


function TreeNode({ data, name, path, currentSelection, defaultExpanded = false }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const { setViewingNodePath, setNodeForColumnSelection } = useStore.getState();

  const isObject = typeof data === 'object' && data !== null && !Array.isArray(data);
  const isArray = Array.isArray(data);
  const isExpandable = (isObject || isArray) && data && Object.keys(data).filter(k => k !== '@attributes').length > 0;
  
  const isSelected = currentSelection && JSON.stringify(currentSelection) === JSON.stringify(path);

  const handleToggleExpand = (e) => {
    e.stopPropagation();
    if (isExpandable) {
      setIsExpanded(!isExpanded);
    }
  };
  
  const handleViewNode = (e) => {
    e.stopPropagation();
    if (isArray) {
        setNodeForColumnSelection(path);
    } else {
        setViewingNodePath(path);
    }
  }

  const displayName = getDisplayName(name, data);

  return (
    <li className="tree-node">
      <div className={clsx("tree-node-label", {selected: isSelected})} onClick={handleToggleExpand}>
        {isExpandable ? (
          <span className="icon">{isExpanded ? 'expand_more' : 'chevron_right'}</span>
        ) : (
          <span className="icon" style={{ opacity: 0, cursor: 'default' }}></span> // placeholder for alignment
        )}
        <span className="node-name">{displayName}</span>
        {isArray && <span className="node-meta">[{data.length}]</span>}
        <button className="view-node-btn" title={`View ${name}`} onClick={handleViewNode}>
            <span className="icon" style={{fontSize: '18px'}}>visibility</span>
        </button>
      </div>

      {isExpanded && isExpandable && (
        <ul>
          {Object.entries(data)
            .filter(([key]) => key !== '@attributes')
            .map(([key, value]) => (
                <TreeNode key={key} name={key} data={value} path={[...path, key]} currentSelection={currentSelection} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function TreeView({ data }) {
  const viewingNodePath = useStore.use.viewingNodePath();
  return (
    <ul style={{ paddingLeft: '0' }}>
      {Object.entries(data).map(([key, value]) => (
        <TreeNode key={key} name={key} data={value} path={[key]} currentSelection={viewingNodePath} defaultExpanded />
      ))}
    </ul>
  );
}