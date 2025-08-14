import React from 'react';
import useStore from '../lib/store';
import { jsonToXml } from '../lib/xmlUtils';
import TreeView from './TreeView';
import DataTable from './DataTable';

function downloadFile(filename, content) {
  const element = document.createElement('a');
  const file = new Blob([content], { type: 'text/xml' });
  element.href = URL.createObjectURL(file);
  element.download = filename;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

export default function Editor() {
  const { fileName, xmlDoc, reset, invalidCharsRemoved } = useStore.getState();

  const handleDownload = () => {
    if (!xmlDoc) return;
    try {
      const xmlString = jsonToXml(xmlDoc.doc, xmlDoc.rootName);
      downloadFile(fileName, xmlString);
    } catch (error) {
      console.error('Failed to generate XML:', error);
      alert('Error generating XML file.');
    }
  };

  return (
    <div className="editor-layout">
      <header className="editor-header">
        <div className="editor-header-title">
          <h1>Tally Code Editor</h1>
          <span className="file-info">{fileName}</span>
          {invalidCharsRemoved > 0 && (
            <span className="file-info" style={{color: 'var(--accent-green)'}}>
              {invalidCharsRemoved} invalid characters removed
            </span>
          )}
        </div>
        <div className="header-actions">
           <button onClick={reset} className="action-button secondary">
            <span className="icon">close</span> Close File
          </button>
          <button onClick={handleDownload} className="action-button primary">
            <span className="icon">download</span> Download XML
          </button>
        </div>
      </header>
      <main className="editor-main">
        <aside className="sidebar">
            <TreeView data={xmlDoc.doc} />
        </aside>
        <div className="main-content">
          <DataTable />
        </div>
      </main>
    </div>
  );
}
