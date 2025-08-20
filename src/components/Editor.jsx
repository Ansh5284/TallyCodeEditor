import React from 'react';
import useStore from '../lib/store';
import { jsonToXml } from '../lib/xmlUtils';
import TreeView from './TreeView';
import DataTable from './DataTable';
import ColumnSelectorModal from './ColumnSelectorModal';
import CleaningLogNotification from './CleaningLogNotification';

function downloadFile(filename, content, mimeType) {
  const element = document.createElement('a');
  const file = new Blob([content], { type: mimeType });
  element.href = URL.createObjectURL(file);
  element.download = filename;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

export default function Editor() {
  const fileName = useStore.use.fileName();
  const xmlDoc = useStore.use.xmlDoc();
  const reset = useStore.use.reset();
  const nodeForColumnSelection = useStore.use.nodeForColumnSelection();

  const handleDownload = () => {
    if (!xmlDoc) return;
    try {
      // Correctly pass the entire document object to the XML generator.
      const xmlString = jsonToXml(xmlDoc.doc, xmlDoc.rootName);
      downloadFile(fileName, xmlString, 'text/xml');
    } catch (error) {
      console.error('Failed to generate XML:', error);
      alert('Error generating XML file.');
    }
  };

  const handleDownloadJson = () => {
    if (!xmlDoc) return;
    try {
      const jsonString = JSON.stringify(xmlDoc.doc, null, 2);
      const jsonFileName = fileName.replace(/\.xml$/i, '.json');
      downloadFile(jsonFileName, jsonString, 'application/json');
    } catch (error) {
      console.error('Failed to generate JSON:', error);
      alert('Error generating JSON file.');
    }
  };
  
  // This check adds robustness, though the parent <App> component should prevent this case.
  if (!xmlDoc) {
    return null;
  }

  return (
    <div className="editor-layout">
      <header className="editor-header">
        <div className="editor-header-title">
          <h1>Tally Code Editor</h1>
          <span className="file-info">{fileName}</span>
        </div>
        <div className="header-actions">
           <button onClick={reset} className="action-button secondary">
            <span className="icon">close</span> Close File
          </button>
          <button onClick={handleDownloadJson} className="action-button secondary">
            <span className="icon">data_object</span> Download JSON
          </button>
          <button onClick={handleDownload} className="action-button primary">
            <span className="icon">download</span> Download XML
          </button>
        </div>
      </header>
       <CleaningLogNotification />
      <main className="editor-main">
        <aside className="sidebar">
            <TreeView data={xmlDoc.doc} />
        </aside>
        <div className="main-content">
          <DataTable />
        </div>
      </main>
      {nodeForColumnSelection && <ColumnSelectorModal />}
    </div>
  );
}