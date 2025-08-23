import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createSelectorFunctions } from 'auto-zustand-selectors-hook';
import get from 'lodash.get';
import { set } from 'lodash';


const useStoreBase = create(
  immer((set, getStore) => ({
    fileName: '',
    xmlDoc: null, // Will be { doc, rootName, originalXml }
    viewingNodePath: null, // Will be an array of path segments, e.g., ['ENVELOPE', 'BODY', 0, 'DATA']
    viewingHistory: [],
    nodeForColumnSelection: null, // Will be { path, parentPath, data }
    tableColumns: {}, // { [pathKey]: ['col1', { parent: 'nested', child: 'col2' }] }
    tableFilters: {}, // { [pathKey]: { [headerKey]: 'filter string' } }
    invalidCharsRemoved: 0,
    cleaningLog: [],

    setFile: (name, docData, count, log) =>
      set((state) => {
        state.fileName = name;
        state.xmlDoc = docData;
        state.invalidCharsRemoved = count;
        state.cleaningLog = log;
        state.viewingNodePath = null;
        state.viewingHistory = [];
        state.nodeForColumnSelection = null;
        state.tableColumns = {};
        state.tableFilters = {};
      }),

    setViewingNodePath: (path) =>
      set((state) => {
        if (!path) {
          state.viewingNodePath = null;
          return;
        }

        const currentPathKey = state.viewingNodePath ? JSON.stringify(state.viewingNodePath) : null;
        const newPathKey = JSON.stringify(path);
        
        if (newPathKey !== currentPathKey) {
           if (state.viewingNodePath) {
            state.viewingHistory.push(state.viewingNodePath);
          }
          state.viewingNodePath = path;
        }
      }),

    goBack: () =>
      set((state) => {
        if (state.viewingHistory.length > 0) {
          state.viewingNodePath = state.viewingHistory.pop();
        }
      }),
    
    setNodeForColumnSelection: (path, parentPath = null, data = null) => 
      set((state) => {
        state.nodeForColumnSelection = path ? { path, parentPath, data } : null;
      }),
      
    setTableColumns: (path, columns) =>
      set((state) => {
        const pathKey = JSON.stringify(path);
        state.tableColumns[pathKey] = columns;
      }),

    setTableFilter: (path, headerKey, filterValue) =>
      set((state) => {
        const pathKey = JSON.stringify(path);
        if (!state.tableFilters[pathKey]) {
          state.tableFilters[pathKey] = {};
        }
        if (filterValue) {
          state.tableFilters[pathKey][headerKey] = filterValue;
        } else {
          // Remove filter if value is empty/null
          delete state.tableFilters[pathKey][headerKey];
          if (Object.keys(state.tableFilters[pathKey]).length === 0) {
            delete state.tableFilters[pathKey];
          }
        }
      }),

    updateNodeValue: (path, newValue) =>
      set((state) => {
        if (!path || path.length === 0) return;
        
        // Use a safe setter like lodash's set which handles array paths correctly.
        // We need to construct the full path within the doc object.
        const fullPath = [state.xmlDoc.rootName, ...path];
        set(state.xmlDoc.doc, fullPath, newValue);
      }),
      
    deleteRow: (path, index) =>
      set((state) => {
        // We get the path to the array itself.
        const array = get(getStore().xmlDoc.doc, path);
        if (Array.isArray(array)) {
            array.splice(index, 1);
        } else {
            console.warn(`Attempted to delete row from non-array at path: ${path.join('.')}`);
        }
      }),

    reset: () =>
      set((state) => {
        state.fileName = '';
        state.xmlDoc = null;
        state.viewingNodePath = null;
        state.viewingHistory = [];
        state.nodeForColumnSelection = null;
        state.tableColumns = {};
        state.tableFilters = {};
        state.invalidCharsRemoved = 0;
        state.cleaningLog = [];
      }),
  }))
);

export default createSelectorFunctions(useStoreBase);