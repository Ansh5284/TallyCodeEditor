import React from 'react';
import useStore from '../lib/store';
import FileUploader from './FileUploader';
import Editor from './Editor';

export default function App() {
  const xmlDoc = useStore.use.xmlDoc();

  return (
    <div className="app">
      {xmlDoc ? <Editor /> : <FileUploader />}
    </div>
  );
}
