
import React from 'react';

interface PlaceholderProps {
  title: string;
  icon: React.ReactNode;
}

const Placeholder: React.FC<PlaceholderProps> = ({ title, icon }) => {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-500">
      <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-6 shadow-inner border border-blue-100">
        {icon}
      </div>
      <h2 className="text-3xl font-bold text-slate-800 mb-4">{title}</h2>
      <p className="text-slate-500 max-w-md text-lg leading-relaxed">
        We're currently migrating this section to our new proprietary platform. 
        This module will feature enhanced AI integration and custom n8n triggers.
      </p>
      <div className="mt-8 flex gap-3">
        <div className="h-2 w-2 bg-blue-600 rounded-full animate-bounce"></div>
        <div className="h-2 w-2 bg-blue-600 rounded-full animate-bounce delay-75"></div>
        <div className="h-2 w-2 bg-blue-600 rounded-full animate-bounce delay-150"></div>
      </div>
    </div>
  );
};

export default Placeholder;
