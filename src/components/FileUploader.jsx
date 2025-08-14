import React, { useState, useCallback } from 'react';
import useStore from '../lib/store';
import { cleanXML, parseXML } from '../lib/xmlUtils';
import clsx from 'clsx';

export default function FileUploader() {
  const setFile = useStore.use.setFile();
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  const handleFile = useCallback(
    async (file) => {
      if (file && file.type === 'text/xml') {
        setLoading(true);
        setError('');
        try {
          const text = await file.text();
          const { cleaned, removedCount } = cleanXML(text);
          const { doc, rootName } = parseXML(cleaned);
          
          const fileData = {
            doc: { [rootName]: doc }, // Wrap with root element name
            rootName: rootName,
            originalXml: cleaned
          };
          
          setFile(file.name, fileData, removedCount);
        } catch (e) {
          console.error('File processing error:', e);
          setError(`Failed to parse XML file. Please check the file format. Error: ${e.message}`);
          setLoading(false);
        }
      } else {
        setError('Please upload a valid XML file.');
      }
    },
    [setFile]
  );

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      handleFile(file);
    },
    [handleFile]
  );

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    handleFile(file);
  };

  return (
    <div className="file-uploader-container">
      <h1>
        <span className="icon">receipt_long</span> Tally Code Editor
      </h1>
      <div
        className={clsx('drop-zone', { dragging })}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        {loading ? (
          <p>Processing...</p>
        ) : (
          <>
            <span className="icon">upload_file</span>
            <p>Drag & drop your Tally XML file here</p>
            <p style={{ margin: '8px 0', fontSize: '0.9em' }}>or</p>
            <button type="button" className="upload-button">
              Click to select file
            </button>
          </>
        )}
      </div>
      <input
        type="file"
        id="file-input"
        accept=".xml,text/xml"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      {error && <p style={{ color: 'var(--accent-red)' }}>{error}</p>}
    </div>
  );
}
