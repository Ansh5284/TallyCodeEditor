import React, { useState, Fragment } from 'react';
import useStore from '../lib/store';
import get from 'lodash.get';
import EditableCell from './EditableCell';

const getHeaders = (dataArray) => {
  if (!dataArray || dataArray.length === 0) return [];
  const headerSet = new Set();
  dataArray.forEach(item => {
    if (typeof item === 'object' && item !== null) {
      Object.keys(item).forEach(key => headerSet.add(key));
    }
  });
  return Array.from(headerSet);
};

function DataTableContent({ data, pathPrefix }) {
    const [expandedRows, setExpandedRows] = useState({});

    if (!Array.isArray(data) || data.length === 0) {
        return <div className="placeholder"><p>This node contains no data to display in a table.</p></div>;
    }

    const headers = getHeaders(data);
    
    const toggleRow = (index) => {
        setExpandedRows(prev => ({...prev, [index]: !prev[index]}));
    }

    return (
        <table className="data-table">
            <thead>
                <tr>
                    {headers.map(header => <th key={header}>{header}</th>)}
                </tr>
            </thead>
            <tbody>
                {data.map((row, rowIndex) => (
                    <Fragment key={rowIndex}>
                        <tr>
                            {headers.map(header => {
                                const cellData = (typeof row === 'object' && row !== null) ? row[header] : (header === 'value' ? row : undefined);
                                const cellPath = `${pathPrefix}.${rowIndex}.${header}`;

                                return (
                                    <td key={header}>
                                        {Array.isArray(cellData) ? (
                                            <button className="nested-table-btn" onClick={() => toggleRow(rowIndex)}>
                                                <span className="icon">table</span>
                                                {expandedRows[rowIndex] ? 'Hide' : 'Show'} Nested Table ({cellData.length})
                                            </button>
                                        ) : typeof cellData === 'object' && cellData !== null ? (
                                            <span style={{color: 'var(--fg-muted)', fontStyle: 'italic'}}>[Object]</span>
                                        ) : (
                                            <EditableCell value={cellData} path={cellPath} />
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                        {expandedRows[rowIndex] && (
                             <tr className="nested-table-row">
                                <td colSpan={headers.length}>
                                    <div className="nested-table-container">
                                        <DataTableContent data={row[headers.find(h => Array.isArray(row[h]))]} pathPrefix={`${pathPrefix}.${rowIndex}.${headers.find(h => Array.isArray(row[h]))}`} />
                                    </div>
                                </td>
                            </tr>
                        )}
                    </Fragment>
                ))}
            </tbody>
        </table>
    );
}


export default function DataTable() {
  const selectedNodePath = useStore.use.selectedNodePath();
  const xmlDoc = useStore.use.xmlDoc();

  if (!selectedNodePath) {
    return (
      <div className="placeholder">
        <span className="icon">ads_click</span>
        <p>Select a data node from the tree on the left to view it as a table.</p>
      </div>
    );
  }

  const data = get(xmlDoc.doc, selectedNodePath);

  return (
    <div className="data-table-wrapper">
        <DataTableContent data={data} pathPrefix={selectedNodePath} />
    </div>
  );
}
