import React, { useState, useMemo, useEffect, useRef } from 'react';
import useStore from '../lib/store';
import { getHeadersFromAllItems } from './ColumnSelectorModal';
import get from 'lodash.get';

export default function AdvancedFilterPopover({ headerKey, path, onClose, rows }) {
    const { setTableFilter, tableFilters } = useStore.getState();
    const pathKey = JSON.stringify(path);
    const currentFilter = tableFilters[pathKey]?.[headerKey] || {};

    const [drilldownPath, setDrilldownPath] = useState([]);
    const [selectedKey, setSelectedKey] = useState(null);
    const [filterInput, setFilterInput] = useState(currentFilter.query || '');
    const inputRef = useRef(null);
    
    // On mount, check for an existing filter and set the initial state
    useEffect(() => {
        if (currentFilter.key && typeof currentFilter.key === 'string') {
            const parts = currentFilter.key.split('.');
            if (parts.length > 1) {
                setDrilldownPath(parts.slice(0, -1));
                setSelectedKey(parts.slice(-1)[0]);
            } else {
                setSelectedKey(currentFilter.key);
            }
        }
    }, []); // Note: Empty dependency array ensures this runs only once on mount

    // Analyzes and returns the available keys at the current drilldown level
    const displayedKeys = useMemo(() => {
        // 1. Get the initial set of objects for the column, flattening arrays
        let currentLevelObjects = rows
            .map(row => row[headerKey]?.value)
            .filter(v => typeof v === 'object' && v !== null)
            .flat();

        // 2. Drill down to the current path
        if (drilldownPath.length > 0) {
            currentLevelObjects = currentLevelObjects
                .map(obj => get(obj, drilldownPath))
                .filter(v => typeof v === 'object' && v !== null)
                .flat();
        }
        
        // 3. Get all unique headers from this level
        const allHeaders = getHeadersFromAllItems(currentLevelObjects);

        // 4. Analyze each header to see if it points to another nested object/array
        return allHeaders.map(headerName => {
            let isNested = false;
            for (const item of currentLevelObjects) {
                if(typeof item !== 'object' || item === null) continue;

                const pathSegments = headerName.startsWith('@') ? ['@attributes', headerName.substring(1)] : [headerName];
                const value = get(item, pathSegments);

                if (typeof value === 'object' && value !== null) {
                    isNested = true;
                    break; // Found one nested value, so this key is considered expandable
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
        const fullKeyPath = [...drilldownPath, selectedKey].join('.');
        setTableFilter(path, headerKey, {
            type: 'advanced',
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
        if (header.startsWith('@')) return header.substring(1);
        if (header === '#text') return 'Text Content';
        return header;
    };
    
    const currentPathForDisplay = [headerKey, ...drilldownPath].join('.');

    return (
        <div className="advanced-filter-popover" onClick={e => e.stopPropagation()}>
            <div className="advanced-filter-header">
                 {(selectedKey || drilldownPath.length > 0) && (
                     <button className="action-button secondary" onClick={handleBack} title="Back">
                        <span className="icon">arrow_back</span>
                    </button>
                 )}
                 <p title={selectedKey ? `${currentPathForDisplay}.${selectedKey}` : `Filter within ${currentPathForDisplay}`}>
                    {selectedKey ? `${currentPathForDisplay}.${selectedKey}` : `Filter within ${currentPathForDisplay}`}
                 </p>
            </div>
            <div className="advanced-filter-body">
                {!selectedKey ? (
                    <ul className="key-list">
                        {displayedKeys.map(key => (
                            <li key={key.name} className="key-list-item">
                                <button onClick={() => handleKeyClick(key)}>
                                    <span>{getHeaderDisplayName(key.name)}</span>
                                    {key.isNested && <span className="icon">chevron_right</span>}
                                </button>
                            </li>
                        ))}
                         {displayedKeys.length === 0 && <p style={{color: 'var(--fg-muted)', fontStyle: 'italic', padding: '8px'}}>No filterable fields found.</p>}
                    </ul>
                ) : (
                    <div className="filter-input-section">
                        <div className="filter-popover">
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder={`Filter by ${selectedKey}...`}
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