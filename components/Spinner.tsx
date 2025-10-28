
import React from 'react';

const Spinner: React.FC = () => {
  return (
    <div className="flex justify-center items-center p-8">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--brand-red) transparent transparent transparent' }}></div>
    </div>
  );
};

export default Spinner;
