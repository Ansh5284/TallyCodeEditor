import React from 'react';
import useStore from '../lib/store';
import get from 'lodash.get';
import EditableCell from './EditableCell';
import ValueRenderer from './ValueRenderer';

function getHeaderKey(header) {
    if (typeof header === 'object' && header !== null) {
        // Creates a consistent key like 'PARENT.CHILD' from the complex header object
        return `${header.parent.join('.')}.${header.child}`;
    }
    return header;
}

/**
 * Case-insensitive version of lodash.get.
 * Required because headers might be lowercase while data keys are uppercase.
 * @param {object} obj - The object to search within.
 * @param {Array<string>} pathSegments - The path to the desired property.
 * @returns {{value: any, actualPath: Array<string>}} The found value and the actual case-sensitive path.
 */
function caseInsensitiveGet(obj, pathSegments) {
    let current = obj;
    const actualPath = [];
    for (const segment of pathSegments) {
        if (current === null || current === undefined) return { value: undefined, actualPath: null };
        
        // Find the key in the current object that matches the segment case-insensitively.
        const key = Object.keys(current).find(k => k.toLowerCase() === segment.toLowerCase());
        
        if (key === undefined) return { value: undefined, actualPath: null };
        
        current = current[key];
        actualPath.push(key);
    }
    return { value: current, actualPath };
}


/**
 * Flattens a single row of hierarchical data into multiple flat rows based on the headers.
 * This function handles nested arrays by creating a cartesian product.
 * @param {object} row - The original data object for the row.
 * @param {number} rowIndex - The index of the original row in the source data array.
 * @param {Array<string|object>} headers - The column definitions.
 * @param {Array<string>} pathPrefix - The base path to the source data array.
 * @returns {Array<object>} An array of flat row objects.
 */
function flattenRow(row, rowIndex, headers, pathPrefix) {
    // wipRows (Work-In-Progress Rows) stores the state for each flattened row being built.
    // - values: A map of { headerKey: { value, path } }
    // - contexts: A map that tracks the specific nested item and its actual path for each expansion level.
    let wipRows = [{ values: {}, contexts: {} }];

    headers.forEach(header => {
        const headerKey = getHeaderKey(header);
        const nextWipRows = [];

        for (const wip of wipRows) {
            const isComplex = typeof header === 'object' && header !== null;

            if (!isComplex) {
                // SIMPLE HEADER: value is relative to the original row object.
                const pathSegments = header.split('.');
                const { value, actualPath } = caseInsensitiveGet(row, pathSegments);
                const path = actualPath ? [...pathPrefix, rowIndex, ...actualPath] : undefined;
                
                nextWipRows.push({
                    ...wip,
                    values: { ...wip.values, [headerKey]: { value, path } }
                });

            } else { // COMPLEX HEADER: value is relative to a nested context.
                const parentPathKey = header.parent.join('.');
                
                // Find the deepest context this header's path belongs to.
                let context = { item: row, path: [...pathPrefix, rowIndex] };
                let longestPrefix = '';
                
                for (const contextKey in wip.contexts) {
                    if (parentPathKey.startsWith(contextKey) && contextKey.length > longestPrefix.length) {
                        longestPrefix = contextKey;
                        context = wip.contexts[contextKey];
                    }
                }
                
                const relativePathSegments = header.parent.slice(longestPrefix.split('.').filter(Boolean).length);
                const { value: dataBranch, actualPath: actualRelativePath } = caseInsensitiveGet(context.item, relativePathSegments);

                const items = Array.isArray(dataBranch) ? dataBranch : (dataBranch !== undefined && dataBranch !== null ? [dataBranch] : []);

                if (items.length === 0) {
                    // No items to expand, so just add an empty value for this column.
                    nextWipRows.push({
                        ...wip,
                        values: { ...wip.values, [headerKey]: { value: undefined, path: undefined } },
                    });
                } else {
                    // Create a new WIP row for each item in the nested array/object.
                    items.forEach((item, itemIndex) => {
                        const newWip = {
                            values: { ...wip.values },
                            contexts: { ...wip.contexts },
                        };
                        
                        const newContextPath = [...context.path, ...actualRelativePath];
                        if (Array.isArray(dataBranch)) {
                            newContextPath.push(itemIndex);
                        }
                        newWip.contexts[parentPathKey] = { item, path: newContextPath };

                        const childIsAttribute = header.child.startsWith('@');
                        const childSegment = childIsAttribute ? header.child.substring(1) : header.child;
                        
                        let value, path;
                        
                        if (childIsAttribute) {
                            const { value: attrValue, actualPath: attrPath } = caseInsensitiveGet(item, ['@attributes', childSegment]);
                            value = attrValue;
                            path = attrPath ? [...newContextPath, ...attrPath] : undefined;
                        } else if (header.child === 'value') {
                             value = item;
                             path = newContextPath;
                        } else {
                            const { value: childValue, actualPath: childPath } = caseInsensitiveGet(item, [childSegment]);
                            value = childValue;
                            path = childPath ? [...newContextPath, ...childPath] : undefined;
                        }
                        
                        newWip.values[headerKey] = { value, path };
                        nextWipRows.push(newWip);
                    });
                }
            }
        }
        wipRows = nextWipRows;
    });

    return wipRows.map(wip => ({ ...wip.values, __originalIndex: rowIndex }));
}


function DataTableContent({ data, headers, pathPrefix, onDeleteRow }) {
    if (!Array.isArray(data) || data.length === 0) {
        return <div className="placeholder"><p>This node contains no data to display in a table.</p></div>;
    }

    const handleDelete = (originalIndex) => {
        if (window.confirm('Are you sure you want to delete this row?')) {
            onDeleteRow(originalIndex);
        }
    };

    const allFlatRows = data.flatMap((row, rowIndex) => flattenRow(row, rowIndex, headers, pathPrefix));

    return (
        <table className="data-table">
            <thead>
                <tr>
                    {headers.map((header) => {
                        const isComplex = typeof header === 'object';
                        const key = getHeaderKey(header);
                        const name = isComplex ? key : (header.startsWith('@') ? header.substring(1) : header);
                        return <th key={key}>{name}</th>
                    })}
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {allFlatRows.map((flatRow, flatRowIndex) => {
                    // Determine if this is the first sub-row for a given original data row.
                    // This is used to render the delete button only once with a correct rowspan.
                    const isFirstInGroup = flatRowIndex === 0 || allFlatRows[flatRowIndex - 1].__originalIndex !== flatRow.__originalIndex;
                    const rowSpan = isFirstInGroup
                        ? allFlatRows.filter(r => r.__originalIndex === flatRow.__originalIndex).length
                        : 1;

                    return (
                        <tr key={flatRowIndex}>
                            {headers.map((header) => {
                                const headerKey = getHeaderKey(header);
                                const cell = flatRow[headerKey] || { value: undefined, path: undefined };
                                return (
                                    <td key={headerKey}>
                                        <ValueRenderer value={cell.value} path={cell.path} />
                                    </td>
                                );
                            })}
                            
                            {isFirstInGroup && (
                                <td rowSpan={rowSpan} style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                    <button
                                        className="delete-action-btn"
                                        title="Delete row"
                                        onClick={() => handleDelete(flatRow.__originalIndex)}
                                    >
                                        <span className="icon">delete</span>
                                    </button>
                                </td>
                            )}
                        </tr>
                    )
                })}
            </tbody>
        </table>
    );
}

function ObjectViewer({ data, path }) {
    const textValue = data['#text'];
    const childEntries = Object.entries(data).filter(([key]) => key !== '@attributes' && key !== '#text');

    return (
        <div className="object-viewer">
            <table className="object-viewer-table">
                <tbody>
                    {textValue !== undefined && textValue !== null && (
                        <tr>
                            <td className="object-viewer-key">#text</td>
                            <td>
                                <EditableCell value={textValue} path={[...path, '#text']} />
                            </td>
                        </tr>
                    )}
                    {childEntries.map(([key, value]) => (
                         <tr key={key}>
                            <td className="object-viewer-key">{key}</td>
                             <td>
                                <ValueRenderer value={value} path={[...path, key]} />
                            </td>
                         </tr>
                    ))}
                    {(textValue === undefined || textValue === null) && childEntries.length === 0 && (
                        <tr>
                            <td colSpan="2" style={{color: 'var(--fg-muted)', fontStyle: 'italic'}}>This object is empty.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

function ValueEditor({data, path}) {
    return (
         <div className="value-editor">
            <div className="editable-cell-wrapper">
                <EditableCell value={data} path={path} />
            </div>
        </div>
    )
}

export default function DataTable() {
  const viewingNodePath = useStore.use.viewingNodePath();
  const xmlDoc = useStore.use.xmlDoc();
  const tableColumns = useStore.use.tableColumns();
  const { goBack, deleteRow } = useStore.getState();
  const viewingHistory = useStore.use.viewingHistory();

  if (!viewingNodePath) {
    return (
      <div className="placeholder">
        <span className="icon">ads_click</span>
        <p>Select a data node from the tree and click the <span className="icon" style={{verticalAlign: 'bottom'}}>visibility</span> icon to view its content.</p>
      </div>
    );
  }

  // Use the array path directly with lodash.get
  const data = get(xmlDoc.doc, viewingNodePath);
  const pathForDisplay = viewingNodePath.join('.');
  
  if (data === undefined) {
      return (
          <div className="placeholder">
              <span className="icon">error</span>
              <p>Could not find data at path: <strong>{pathForDisplay}</strong></p>
          </div>
      )
  }
  
  const handleDeleteRow = (index) => {
    // Pass the array path to the action
    deleteRow(viewingNodePath, index);
  };

  const renderContent = () => {
    if(Array.isArray(data)) {
        const pathKey = JSON.stringify(viewingNodePath);
        const columns = tableColumns[pathKey];
        if (!columns) {
            return (
                <div className="placeholder">
                    <span className="icon">view_column</span>
                    <p>This is a table node. Use the <span className="icon" style={{verticalAlign: 'bottom'}}>visibility</span> icon in the tree to select which columns to display.</p>
                </div>
            )
        }
        return <DataTableContent data={data} headers={columns} pathPrefix={viewingNodePath} onDeleteRow={handleDeleteRow} />
    }
    
    if (typeof data === 'object' && data !== null) {
        return <ObjectViewer data={data} path={viewingNodePath} />;
    }

    // For primitive values (string, number, boolean, null)
    return <ValueEditor data={data} path={viewingNodePath} />
  }
  
  const getHeaderTitle = () => {
     if (Array.isArray(data)) {
         return `Table: ${pathForDisplay}`;
     }
     if (typeof data === 'object' && data !== null) {
         return `Object: ${pathForDisplay}`;
     }
     return `Value: ${pathForDisplay}`;
  }

  return (
    <div className="data-panel">
        <div className="main-content-header">
            {viewingHistory.length > 0 && (
                <button onClick={goBack} className="action-button secondary" style={{padding: '8px'}} title="Go Back">
                    <span className="icon">arrow_back</span>
                </button>
            )}
            <h2 title={pathForDisplay}>{getHeaderTitle()}</h2>
        </div>
        <div className="data-table-wrapper">
            {renderContent()}
        </div>
    </div>
  );
}
