import React, { useState, useMemo, useEffect } from 'react';
import useStore from '../lib/store';
import get from 'lodash.get';

// Helper to get all unique keys from an array of objects or a single object
export const getHeadersFromAllItems = (data) => {
  const dataArray = Array.isArray(data) 
    ? data 
    : (typeof data === 'object' && data !== null ? [data] : []);
    
  if (dataArray.length === 0) return [];
  const headerSet = new Set();
  
  dataArray.forEach(item => {
    if (typeof item === 'object' && item !== null) {
      // Add child node keys
      Object.keys(item).forEach(key => {
        if (key !== '@attributes' && key !== '#text') {
          headerSet.add(key);
        }
      });
      // Add attribute keys, prefixed with '@'
      if (item['@attributes']) {
        Object.keys(item['@attributes']).forEach(attrKey => {
          headerSet.add(`@${attrKey}`);
        });
      }
      // If there's a text value, add '#text' as a possible column
      if (typeof item['#text'] === 'string' && item['#text'].trim() !== '') {
          headerSet.add('#text');
      }
    } else if (item !== null && item !== undefined) {
      // For arrays of primitives like <FOO>a</FOO><FOO>b</FOO>
      headerSet.add('value');
    }
  });

  return Array.from(headerSet).sort((a, b) => {
    const isAAttr = a.startsWith('@');
    const isBAttr = b.startsWith('@');
    if (isAAttr && !isBAttr) return -1;
    if (!isAAttr && isBAttr) return 1;
    if (a === '#text' || a === 'value') return -1;
    if (b === '#text' || b === 'value') return 1;
    return a.localeCompare(b);
  });
};


export default function ColumnSelectorModal() {
  const { 
    nodeForColumnSelection, 
    xmlDoc,
    tableColumns,
    setTableColumns,
    setViewingNodePath,
    setNodeForColumnSelection 
  } = useStore.getState();
  
  const path = nodeForColumnSelection?.path;
  const parentPath = nodeForColumnSelection?.parentPath;
  const pathKey = path ? JSON.stringify(path) : null;
  const parentPathKey = parentPath ? JSON.stringify(parentPath) : null;

  const [filter, setFilter] = useState('');

  const data = useMemo(() => {
    if (!path || !xmlDoc) return null;
    return get(xmlDoc.doc, path);
  }, [path, xmlDoc]);
  
  // This logic finds the data we want to get columns from.
  // It drills down into wrapper objects if needed, but only when viewing from the tree.
  const { sourceArray, arrayPath } = useMemo(() => {
    if (!data) return { sourceArray: [], arrayPath: [] };

    // If we are expanding from within a table (parentPath exists), 
    // do not drill down. The user wants to see the columns of the object they clicked on.
    if (parentPath) {
      return { sourceArray: data, arrayPath: [] };
    }

    // If we are expanding from the tree view (no parent table context),
    // we can apply "smart" logic to drill into wrapper objects.
    // e.g., if data is { "ITEMS": { "ITEM": [...] } }, we want to get to the [...] array.
    let currentData = data;
    let pathSegments = [];

    while (
      !Array.isArray(currentData) &&
      typeof currentData === 'object' &&
      currentData !== null
    ) {
      const keys = Object.keys(currentData).filter(k => k !== '@attributes' && k !== '#text');
      
      if (keys.length === 1) {
        const key = keys[0];
        const child = currentData[key];
        // Only drill down if the child is also an object (or array). Stop at primitives.
        if (typeof child === 'object' && child !== null) {
          pathSegments.push(key);
          currentData = child;
        } else {
          break;
        }
      } else {
        // Stop if we hit a complex object (0 or >1 keys)
        break;
      }
    }
    return { sourceArray: currentData, arrayPath: pathSegments };
  }, [data, parentPath]);


  const allHeaders = useMemo(() => getHeadersFromAllItems(sourceArray), [sourceArray]);
  
  const [selectedHeaders, setSelectedHeaders] = useState(new Set());

  useEffect(() => {
    const actualArrayPath = [...path, ...arrayPath];
    const actualArrayPathKey = JSON.stringify(actualArrayPath);
    const existingSelection = tableColumns[actualArrayPathKey];
    
    // If we are editing an existing table's columns, load its current selection.
    if (existingSelection && !parentPath) {
        setSelectedHeaders(new Set(existingSelection));
    } else {
        // For new tables or when merging, start with NO columns selected.
        setSelectedHeaders(new Set());
    }
  }, [path, arrayPath, parentPath, tableColumns]);

  const filteredHeaders = useMemo(() => {
    if (!filter.trim()) return allHeaders;

    const searchTerms = (filter.match(/"[^"]+"|\S+/g) || [])
      .map(term => term.replace(/"/g, '').toLowerCase())
      .filter(Boolean);

    if (searchTerms.length === 0) return allHeaders;

    return allHeaders.filter(header => {
      const lowerHeader = header.toLowerCase();
      return searchTerms.some(term => lowerHeader.includes(term));
    });
  }, [allHeaders, filter]);


  const handleCheckboxChange = (header, isChecked) => {
    setSelectedHeaders(prev => {
        const newSet = new Set(prev);
        if(isChecked) {
            newSet.add(header);
        } else {
            newSet.delete(header);
        }
        return newSet;
    })
  };

  const handleSelectAll = () => {
    setSelectedHeaders(prev => {
      const newSet = new Set(prev);
      filteredHeaders.forEach(h => newSet.add(h));
      return newSet;
    });
  };

  const handleDeselectAll = () => {
    setSelectedHeaders(prev => {
      const newSet = new Set(prev);
      filteredHeaders.forEach(h => newSet.delete(h));
      return newSet;
    });
  };

  const handleCancel = () => {
    setNodeForColumnSelection(null);
  };

  const handleMergeIntoParent = () => {
    if (!parentPath) return;

    const parentColumns = tableColumns[parentPathKey] || [];
    // The path to the specific item clicked, relative to the row object. May contain indices.
    const pathWithinRow = path.slice(parentPath.length + 1);

    let columnToRemove = null;

    // 1. FIX: Find the column to remove by comparing its abstract path definition
    // with the abstract path of the item that was clicked. This is more reliable.
    const clickedPathAbstract = pathWithinRow.filter(segment => typeof segment !== 'number');

    for (const c of parentColumns) {
        let columnPathDefinition;
        if (typeof c === 'object' && c.parent) {
            columnPathDefinition = [...c.parent, c.child];
        } else if (typeof c === 'string') {
            columnPathDefinition = [c];
        } else {
            continue;
        }

        if (JSON.stringify(columnPathDefinition) === JSON.stringify(clickedPathAbstract)) {
            columnToRemove = c;
            break;
        }
    }
    
    const newParentColumns = columnToRemove
      ? parentColumns.filter(c => c !== columnToRemove)
      : [...parentColumns];
    
    // 2. FIX: Create new column definitions using an abstract path (without indices).
    // The renderer (`DataTable.jsx`) is responsible for accessing the correct indexed data per row.
    // This ensures the new columns work for all rows, not just the one that was clicked.
    const parentPrefixForNewColumns = [...clickedPathAbstract, ...arrayPath];
    
    Array.from(selectedHeaders).forEach(header => {
        newParentColumns.push({
            parent: parentPrefixForNewColumns,
            child: header
        });
    });

    setTableColumns(parentPath, newParentColumns);
    setViewingNodePath(parentPath);
    setNodeForColumnSelection(null);
  };
  
  const isSourceDataArray = Array.isArray(sourceArray);
  
  const handleApply = () => {
    if (parentPath) {
      handleMergeIntoParent();
      return;
    }

    if (!isSourceDataArray) {
      setViewingNodePath(path);
      setNodeForColumnSelection(null);
      return;
    }

    const newPath = [...path, ...arrayPath];
    setTableColumns(newPath, Array.from(selectedHeaders));
    setViewingNodePath(newPath);
    setNodeForColumnSelection(null);
  };

  if (!nodeForColumnSelection) {
    return null;
  }

  const getHeaderDisplayName = (header) => {
    if (header.startsWith('@')) return header.substring(1);
    if (header === '#text') return 'Text Content';
    return header;
  }

  return (
    <div className="modal-overlay" onClick={handleCancel}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
                <h2>Select Columns to Display</h2>
                <button className="action-button secondary" onClick={handleCancel} style={{padding: '4px'}}><span className="icon">close</span></button>
            </div>
             <div className="modal-actions">
                <input
                  type="text"
                  placeholder='Filter columns... (e.g. name "address city")'
                  className="column-filter-input"
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                  aria-label="Filter columns"
                />
                <div className="modal-bulk-actions">
                    <button onClick={handleSelectAll} className="action-button secondary">Select All Visible</button>
                    <button onClick={handleDeselectAll} className="action-button secondary">Deselect All Visible</button>
                </div>
            </div>
            <div className="modal-body">
                <div className="column-list">
                    {filteredHeaders.map(header => (
                        <div key={header} className="column-item">
                           <label>
                             <input 
                                type="checkbox"
                                checked={selectedHeaders.has(header)}
                                onChange={e => handleCheckboxChange(header, e.target.checked)}
                             />
                             {getHeaderDisplayName(header)}
                           </label>
                        </div>
                    ))}
                </div>
                {filteredHeaders.length === 0 && allHeaders.length > 0 && <p style={{color: 'var(--fg-muted)', fontStyle: 'italic'}}>No columns match your filter.</p>}
                {allHeaders.length === 0 && <p style={{color: 'var(--fg-muted)'}}>No columns found in this data.</p>}
            </div>
            <div className="modal-footer">
                <button onClick={handleCancel} className="action-button secondary">Cancel</button>
                <button onClick={handleApply} className="action-button primary">Apply</button>
            </div>
        </div>
    </div>
  )
}