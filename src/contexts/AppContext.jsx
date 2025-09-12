import React, { createContext, useContext, useReducer } from 'react';

const AppContext = createContext();

const initialState = {
  media: [],
  loading: true,
  uploading: false,
  uploadQueue: [],
  isOnline: navigator.onLine,
  error: null
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_MEDIA':
      return { ...state, media: action.payload, loading: false };
    case 'ADD_TO_UPLOAD_QUEUE':
      return { ...state, uploadQueue: [...state.uploadQueue, ...action.payload] };
    case 'REMOVE_FROM_UPLOAD_QUEUE':
      return { ...state, uploadQueue: state.uploadQueue.slice(1) };
    case 'SET_UPLOADING':
      return { ...state, uploading: action.payload };
    case 'SET_ONLINE_STATUS':
      return { ...state, isOnline: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}