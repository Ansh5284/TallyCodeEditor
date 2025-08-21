import React, { useState, useRef, useEffect, useMemo } from 'react';
import useStore from '../lib/store';
import get from 'lodash.get';
import EditableCell from './EditableCell';
import ValueRenderer from './ValueRenderer';
import { parseFilterQuery, testValue } from '../lib/filterParser';
import clsx from 'clsx';
import AdvancedFilterPopover from './AdvancedFilterPopover';

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
    if (!pathSegments) return { value: undefined, actualPath: null };
    for (const segment of pathSegments) {
        if (typeof current !== 'object' || current === null) return { value: undefined, actualPath: null };
        
        // Find the key in the current object that matches the segment case-insensitively.
        const key = Object.keys(current).find(k => k.toLowerCase() === String(segment).toLowerCase());
        
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
                let value;
                let path;

                if (header === 'value') {
                    // This handles arrays of primitives, where 'row' is the primitive itself.
                    value = row;
                    path = [...pathPrefix, rowIndex];
                } else if (typeof row === 'object' && row !== null) {
                    // Standard case: row is an object, find a property within it.
                    let pathSegments;
                    if (header.startsWith('@')) {
                        // Support dot notation within attributes if ever needed, e.g., @ATTR.NESTED
                        pathSegments = ['@attributes', ...header.substring(1).split('.')];
                    } else {
                        // A simple header string is treated as a single key, not a path.
                        pathSegments = [header];
                    }
                    const { value: foundValue, actualPath } = caseInsensitiveGet(row, pathSegments);
                    value = foundValue;
                    path = actualPath ? [...pathPrefix, rowIndex, ...actualPath] : undefined;
                } else {
                    // Row is a primitive, but header is not 'value', so it can't have properties.
                    value = undefined;
                    path = undefined;
                }

                // Fallback for cases like <VOUCHER>123</VOUCHER> where `row` is "123"
                // and the user selected a column like '#text'. The lookup above would fail.
                if (value === undefined && (header === '#text') && typeof row !== 'object') {
                    value = row;
                    path = [...pathPrefix, rowIndex];
                }
                
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

function FilterPopover({ headerKey, path, onClose }) {
    const { setTableFilter, tableFilters } = useStore.getState();
    const pathKey = JSON.stringify(path);
    const currentFilter = tableFilters[pathKey]?.[headerKey] || '';
    const [filterInput, setFilterInput] = useState(currentFilter);
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleApply = () => {
        setTableFilter(path, headerKey, filterInput);
        onClose();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleApply();
        }
        if (e.key === 'Escape') {
            onClose();
        }
    };
    
    const handleClear = () => {
        setFilterInput('');
        setTableFilter(path, headerKey, '');
        onClose();
    };

    return (
        <div className="filter-popover" onClick={e => e.stopPropagation()}>
            <input
                ref={inputRef}
                type="text"
                placeholder='Filter... (e.g. A*B "C D")'
                value={filterInput}
                onChange={e => setFilterInput(e.target.value)}
                onKeyDown={handleKeyDown}
            />
            <button onClick={handleApply} title="Apply"><span className="icon">check</span></button>
            <button onClick={handleClear} title="Clear"><span className="icon">clear</span></button>
        </div>
    );
}


function getColumnFilterType(rows, headerKey) {
    let hasPrimitives = false;
    let hasObjects = false;
    // Check a sample of rows for performance
    for (let i = 0; i < rows.length && i < 50; i++) {
        const cellValue = rows[i][headerKey]?.value;
        if (typeof cellValue === 'object' && cellValue !== null) {
            hasObjects = true;
        } else if (cellValue !== undefined && cellValue !== null) {
            hasPrimitives = true;
        }
    }
    // If a column exclusively contains objects, it's suitable for advanced filtering.
    if (hasObjects && !hasPrimitives) return 'advanced';
    // If it exclusively contains primitives, it gets a simple filter.
    if (hasPrimitives && !hasObjects) return 'simple';
    // Mixed or empty columns are not filterable for now.
    return 'none';
}

/**
 * Recursively checks if a nested path in an object matches filter conditions.
 * Handles arrays at any level of the path by checking if "some" element matches.
 * @param {object|Array} target - The object or array to search within.
 * @param {Array<string>} pathSegments - The path to follow (e.g., ['LEDGERENTRIES.LIST', 'LEDGERNAME']).
 * @param {Array<object>} conditions - The parsed filter conditions from parseFilterQuery.
 * @returns {boolean} - True if a match is found.
 */
const checkPathInObject = (target, pathSegments, conditions) => {
    // If target is an array, check if any element in it matches the full path.
    if (Array.isArray(target)) {
        return target.some(item => checkPathInObject(item, pathSegments, conditions));
    }
    
    // If target is not an object or path is empty, we can't go deeper.
    if (typeof target !== 'object' || target === null || pathSegments.length === 0) {
        return false;
    }

    const [currentSegment, ...remainingSegments] = pathSegments;

    // Find the key in the current object that matches the segment case-insensitively.
    const key = Object.keys(target).find(k => k.toLowerCase() === String(currentSegment).toLowerCase());
    if (key === undefined) return false;
    
    const value = target[key];

    // If we are at the last segment of the path, test the value.
    if (remainingSegments.length === 0) {
        // If the final value is an array, test each element against the conditions.
        if (Array.isArray(value)) {
            return value.some(item => testValue(item, conditions));
        }
        return testValue(value, conditions);
    }
    
    // If not at the end, recurse deeper. The 'value' becomes the new 'target'.
    return checkPathInObject(value, remainingSegments, conditions);
};

function DataTableContent({ data, headers, pathPrefix, onDeleteRow }) {
    const [activeFilter, setActiveFilter] = useState(null);
    const tableFilters = useStore.use.tableFilters();
    const pathKey = JSON.stringify(pathPrefix);
    const filtersForTable = tableFilters[pathKey];

    if (!Array.isArray(data) || data.length === 0) {
        return <div className="placeholder"><p>This node contains no data to display in a table.</p></div>;
    }

    const handleDelete = (originalIndex) => {
        if (window.confirm('Are you sure you want to delete this row?')) {
            onDeleteRow(originalIndex);
        }
    };

    const allFlatRows = data.flatMap((row, rowIndex) => flattenRow(row, rowIndex, headers, pathPrefix));

    const parsedFilters = useMemo(() => {
        if (!filtersForTable) return null;
        const parsed = {};
        for (const headerKey in filtersForTable) {
            const filterConfig = filtersForTable[headerKey];
            if (typeof filterConfig === 'object' && filterConfig.type === 'advanced') {
                parsed[headerKey] = {
                    type: 'advanced',
                    key: filterConfig.key, // Expects an array of path segments
                    conditions: parseFilterQuery(filterConfig.query || ''),
                };
            } else if (filterConfig) {
                // Simple filter (string)
                parsed[headerKey] = {
                    type: 'simple',
                    conditions: parseFilterQuery(String(filterConfig)),
                };
            }
        }
        return parsed;
    }, [filtersForTable]);

    const filteredRows = useMemo(() => {
        if (!parsedFilters || Object.keys(parsedFilters).length === 0) {
            return allFlatRows;
        }
    
        const activeFilterKeys = Object.keys(parsedFilters).filter(key => {
            const p = parsedFilters[key];
            return p.conditions && p.conditions.length > 0;
        });
    
        if (activeFilterKeys.length === 0) {
            return allFlatRows;
        }
    
        const rowMatchesAdvancedFilter = (originalRow, headerKey, filter) => {
            const headerDefinition = headers.find(h => getHeaderKey(h) === headerKey);
            // Advanced filters only work on simple columns (string header) that contain objects.
            if (!headerDefinition || typeof headerDefinition !== 'string') return true;

            const { value: columnData } = caseInsensitiveGet(originalRow, [headerDefinition]);

            if (columnData === undefined || columnData === null) {
                return false;
            }
            
            return checkPathInObject(columnData, filter.key, filter.conditions);
        };
        
        // Helper to apply a simple filter to a single flattened row cell
        const cellMatchesSimpleFilter = (flatRow, headerKey, filter) => {
            const cellValue = flatRow[headerKey]?.value;
            return testValue(cellValue, filter.conditions);
        };
    
        return allFlatRows.filter(flatRow => {
            // A row must match EVERY active filter
            return activeFilterKeys.every(headerKey => {
                const filter = parsedFilters[headerKey];
                
                if (filter.type === 'advanced') {
                    const originalRow = data[flatRow.__originalIndex];
                    if (!originalRow) return false;
                    return rowMatchesAdvancedFilter(originalRow, headerKey, filter);
                }
                
                // 'simple' filter
                return cellMatchesSimpleFilter(flatRow, headerKey, filter);
            });
        });
    }, [allFlatRows, parsedFilters, data, headers]);

    return (
        <table className="data-table">
            <thead>
                <tr>
                    {headers.map((header) => {
                        const isComplex = typeof header === 'object';
                        const key = getHeaderKey(header);
                        const name = isComplex ? key : (header.startsWith('@') ? header.substring(1) : header);
                        const filterType = getColumnFilterType(allFlatRows, key);
                        const currentFilter = filtersForTable?.[key];
                        const isActive = typeof currentFilter === 'string' ? !!currentFilter : !!currentFilter?.query;

                        return (
                            <th key={key}>
                                <div className="th-content">
                                    <span>{name}</span>
                                    {filterType !== 'none' && (
                                        <>
                                            <button
                                                className={clsx("filter-btn", { active: isActive })}
                                                onClick={(e) => { e.stopPropagation(); setActiveFilter(activeFilter === key ? null : key) }}
                                                title="Filter column"
                                            >
                                                <span className="icon">filter_list</span>
                                            </button>
                                            {activeFilter === key && filterType === 'simple' && (
                                                <FilterPopover
                                                    headerKey={key}
                                                    path={pathPrefix}
                                                    onClose={() => setActiveFilter(null)}
                                                />
                                            )}
                                            {activeFilter === key && filterType === 'advanced' && (
                                                <AdvancedFilterPopover
                                                    headerKey={key}
                                                    path={pathPrefix}
                                                    onClose={() => setActiveFilter(null)}
                                                    rows={allFlatRows}
                                                />
                                            )}
                                        </>
                                    )}
                                </div>
                            </th>
                        )
                    })}
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {filteredRows.length > 0 ? (
                    filteredRows.map((row, index) => {
                        const isFirstInGroup = index === 0 || filteredRows[index - 1].__originalIndex !== row.__originalIndex;
                        const rowSpan = isFirstInGroup
                            ? filteredRows.filter(r => r.__originalIndex === row.__originalIndex).length
                            : 1;

                        return (
                            <tr key={index}>
                                {headers.map((header) => {
                                    const headerKey = getHeaderKey(header);
                                    const cell = row[headerKey] || { value: undefined, path: undefined };
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
                                            onClick={() => handleDelete(row.__originalIndex)}
                                        >
                                            <span className="icon">delete</span>
                                        </button>
                                    </td>
                                )}
                            </tr>
                        )
                    })
                ) : (
                    <tr>
                        <td colSpan={headers.length + 1}>
                             <div className="placeholder" style={{ padding: '32px' }}>
                                <span className="icon">search_off</span>
                                <p style={{ fontWeight: 500, color: 'var(--fg-primary)', fontSize: '1.1em', marginTop: '0.5rem' }}>No results match your filter criteria.</p>
                                
                                {filtersForTable && Object.keys(filtersForTable).length > 0 && (
                                    <div style={{ 
                                        textAlign: 'left', 
                                        fontFamily: 'var(--font-mono)', 
                                        fontSize: '0.9em', 
                                        marginTop: '24px', 
                                        padding: '16px',
                                        backgroundColor: 'var(--bg-dark-contrast)',
                                        borderRadius: '6px',
                                        border: '1px solid var(--border-color)',
                                        maxWidth: '600px',
                                        wordBreak: 'break-all'
                                    }}>
                                        <p style={{ fontWeight: 'bold', color: 'var(--fg-secondary)', marginBottom: '12px' }}>Active Filters:</p>
                                        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {Object.entries(filtersForTable).map(([headerKey, filter]) => {
                                                const hasQuery = (typeof filter === 'string' && filter) || (typeof filter === 'object' && filter?.query);
                                                if (!hasQuery) return null;

                                                if (typeof filter === 'object' && filter.type === 'advanced') {
                                                    const fullPath = [headerKey, ...(filter.key || [])].join(' > ');
                                                    return (
                                                        <li key={headerKey}>
                                                            <span style={{ color: 'var(--accent-cyan)' }}>{fullPath}:</span>
                                                            <span style={{ color: 'var(--fg-primary)' }}> "{filter.query}"</span>
                                                        </li>
                                                    );
                                                }
                                                
                                                return (
                                                    <li key={headerKey}>
                                                        <span style={{ color: 'var(--accent-cyan)' }}>{headerKey}:</span>
                                                        <span style={{ color: 'var(--fg-primary)' }}> "{String(filter)}"</span>
                                                    </li>
                                                );
                                            }).filter(Boolean)}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </td>
                    </tr>
                )}
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