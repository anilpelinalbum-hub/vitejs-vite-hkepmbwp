import React from 'react';
import { motion } from 'framer-motion';

export default function LoadingSpinner({ size = 'medium', className = '' }) {
  const sizeClasses = {
    small: 'h-6 w-6',
    medium: 'h-12 w-12',
    large: 'h-16 w-16'
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`flex items-center justify-center p-4 ${className}`}
    >
      <div className={`animate-spin rounded-full border-b-2 border-rose-600 ${sizeClasses[size]}`}></div>
    </motion.div>
  );
}