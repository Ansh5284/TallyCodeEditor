import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createSelectorFunctions } from 'auto-zustand-selectors-hook';
import get from 'lodash.get';

const useStoreBase = create(
  immer((set) => ({
    fileName: '',
    xmlDoc: null, // Will be { doc, rootName, originalXml }
    selectedNodePath: null,
    invalidCharsRemoved: 0,

    setFile: (name, docData, count) =>
      set((state) => {
        state.fileName = name;
        state.xmlDoc = docData;
        state.invalidCharsRemoved = count;
        state.selectedNodePath = null;
      }),

    setSelectedNodePath: (path) =>
      set((state) => {
        // Ensure we are only selecting arrays to be displayed as tables
        const data = get(state.xmlDoc.doc, path);
        if (Array.isArray(data)) {
           state.selectedNodePath = path;
        }
      }),

    updateNodeValue: (path, newValue) =>
      set((state) => {
        const pathArray = path.split('.').filter(p => p);
        let current = state.xmlDoc.doc;
        for (let i = 0; i < pathArray.length - 1; i++) {
          current = current[pathArray[i]];
        }
        current[pathArray[pathArray.length - 1]] = newValue;
      }),

    reset: () =>
      set((state) => {
        state.fileName = '';
        state.xmlDoc = null;
        state.selectedNodePath = null;
        state.invalidCharsRemoved = 0;
      }),
  }))
);

export default createSelectorFunctions(useStoreBase);