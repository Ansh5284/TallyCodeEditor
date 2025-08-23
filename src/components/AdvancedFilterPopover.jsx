import React, { useState, useMemo, useEffect, useRef } from 'react';
import useStore from '../lib/store';
import { getHeadersFromAllItems } from './ColumnSelectorModal';

/**
 * Case-insensitive version of lodash.get, required because data keys from XML are
 * often uppercase, but we want our logic to be flexible.
 * @param {object} obj - The object to search within.
 * @param {Array<string>} pathSegments - The path to the desired property.
 * @returns {{value: any}} The found value.
 */
function caseInsensitiveGet(obj, pathSegments) {
    let current = obj;
    if (!pathSegments || !Array.isArray(pathSegments)) return { value: undefined };
    for (const segment of pathSegments) {
        if (typeof current !== 'object' || current === null) return { value: undefined };
        
        const key = Object.keys(current).find(k => String(k).toLowerCase() === String(segment).toLowerCase());
        
        if (key === undefined) return { value: undefined };
        
        current = current[key];
    }
    return { value: current };
}

export default function AdvancedFilterPopover({ headerKey, path, onClose, rows, filterType = 'advanced' }) {
    const { setTableFilter, tableFilters } = useStore.getState();
    const pathKey = JSON.stringify(path);
    const currentFilter = tableFilters[pathKey]?.[headerKey] || {};

    // drilldownPath is an array of keys representing the path into the nested object
    const [drilldownPath, setDrilldownPath] = useState([]);
    // selectedKey is the final leaf-node key the user wants to filter by
    const [selectedKey, setSelectedKey] = useState(null);
    const [filterInput, setFilterInput] = useState(currentFilter.query || '');
    const inputRef = useRef(null);
    
    // On mount, check for an existing filter and set the initial state
    useEffect(() => {
        if (currentFilter.key && Array.isArray(currentFilter.key)) {
            const keyPath = currentFilter.key;
            if (keyPath.length > 1) {
                setDrilldownPath(keyPath.slice(0, -1));
                setSelectedKey(keyPath.slice(-1)[0]);
            } else if (keyPath.length === 1) {
                setSelectedKey(keyPath[0]);
            }
        }
    }, []); // Runs only on mount

    // Analyzes and returns the available keys at the current drilldown level
    const displayedKeys = useMemo(() => {
        // 1. Get the initial set of objects for the column from all flattened rows.
        let currentLevelObjects = rows
            .map(row => row[headerKey]?.value)
            .filter(v => v !== null && v !== undefined)
            .flat(); // Flatten in case a cell contains an array of objects

        // 2. Drill down to the current path using the case-insensitive helper
        if (drilldownPath.length > 0) {
            currentLevelObjects = currentLevelObjects
                .map(obj => caseInsensitiveGet(obj, drilldownPath).value)
                .filter(v => v !== null && v !== undefined)
                .flat();
        }
        
        // 3. Get all unique headers from all objects at this level
        const allHeaders = getHeadersFromAllItems(currentLevelObjects);

        // 4. Analyze each header to see if it points to another nested object/array
        return allHeaders.map(headerName => {
            let isNested = false;
            // Check a sample of items for performance
            for (let i = 0; i < currentLevelObjects.length && i < 20; i++) {
                const item = currentLevelObjects[i];
                if(typeof item !== 'object' || item === null) continue;

                const pathSegments = headerName.startsWith('@') ? ['@attributes', headerName.substring(1)] : [headerName];
                const { value } = caseInsensitiveGet(item, pathSegments);

                if (typeof value === 'object' && value !== null) {
                    isNested = true;
                    break; // Found one nested value, so this key is expandable
                }
            }
            return { name: headerName, isNested };
        });
    }, [rows, headerKey, drilldownPath]);

    useEffect(() => {
        if (selectedKey) {
            inputRef.current?.focus();
        }
    }, [selectedKey]);
    
    const handleKeyClick = (key) => {
        if (key.isNested) {
            setDrilldownPath(prev => [...prev, key.name]);
        } else {
            setSelectedKey(key.name);
        }
    };
    
    const handleBack = () => {
        if (selectedKey) {
            setSelectedKey(null); // Go from input view to key list
        } else if (drilldownPath.length > 0) {
            setDrilldownPath(prev => prev.slice(0, -1)); // Go up one level
        }
    };

    const handleApply = () => {
        if (!selectedKey) return;
        const fullKeyPath = [...drilldownPath, selectedKey];
        setTableFilter(path, headerKey, {
            type: filterType,
            key: fullKeyPath,
            query: filterInput,
        });
        onClose();
    };
    
    const handleClear = () => {
        setTableFilter(path, headerKey, null);
        onClose();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleApply();
        if (e.key === 'Escape') onClose();
    };
    
    const getHeaderDisplayName = (header) => {
        if (header === null || header === undefined) return '';
        if (header.startsWith('@')) return header.substring(1);
        if (header === '#text') return 'Text Content';
        if (header === 'value') return 'Value';
        return header;
    };
    
    // Construct a readable path for the popover header
    const pathForDisplay = [headerKey, ...drilldownPath].map(getHeaderDisplayName).join(' > ');
    const fullPathForDisplay = selectedKey ? `${pathForDisplay} > ${getHeaderDisplayName(selectedKey)}` : `Filter within: ${pathForDisplay}`;

    return (
        <div className="advanced-filter-popover" onClick={e => e.stopPropagation()}>
            <div className="advanced-filter-header">
                 {(selectedKey || drilldownPath.length > 0) && (
                     <button className="action-button secondary" onClick={handleBack} title="Back">
                        <span className="icon">arrow_back</span>
                    </button>
                 )}
                 <p title={fullPathForDisplay}>
                    {fullPathForDisplay}
                 </p>
            </div>
            <div className="advanced-filter-body">
                {!selectedKey ? (
                    displayedKeys.length > 0 ? (
                        <ul className="key-list">
                            {displayedKeys.map(key => (
                                <li key={key.name} className="key-list-item">
                                    <button onClick={() => handleKeyClick(key)}>
                                        <span>{getHeaderDisplayName(key.name)}</span>
                                        {key.isNested && <span className="icon">chevron_right</span>}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div style={{color: 'var(--fg-muted)', padding: '8px', fontSize: '0.9em'}}>
                            <p>No filterable fields found.</p>
                            <p style={{marginTop: '8px', fontFamily: 'var(--font-mono)', wordBreak: 'break-all', color: 'var(--fg-secondary)'}}>
                                Path: {pathForDisplay}
                            </p>
                        </div>
                    )
                ) : (
                    <div className="filter-input-section">
                        <div className="filter-popover">
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder={`Filter by ${getHeaderDisplayName(selectedKey)}...`}
                                value={filterInput}
                                onChange={e => setFilterInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                            />
                            <button onClick={handleApply} title="Apply"><span className="icon">check</span></button>
                            <button onClick={handleClear} title="Clear"><span className="icon">clear</span></button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}