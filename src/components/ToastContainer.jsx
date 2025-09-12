import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../hooks/useToast';

export function ToastContainer() {
  const { toasts, removeToast } = useToast();
  
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className={`p-4 rounded-lg shadow-lg flex items-center gap-2 ${
              toast.type === 'success' 
                ? 'bg-green-500' 
                : toast.type === 'error'
                ? 'bg-red-500'
                : 'bg-blue-500'
            } text-white`}
          >
            <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}</span>
            <span className="flex-1">{toast.message}</span>
            <button 
              onClick={() => removeToast(toast.id)} 
              className="ml-2 text-white hover:text-gray-200"
              aria-label="Kapat"
            >
              ✕
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}