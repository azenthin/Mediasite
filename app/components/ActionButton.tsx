import React from 'react';

interface ActionButtonProps {
    icon: React.ReactElement;
    label: string;
}

const ActionButton = ({ icon, label }: ActionButtonProps) => (
    <button className="flex flex-col items-center justify-center p-1 md:p-2 text-white/90 hover:text-white transition-colors duration-200" title={label}>
        <div style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.6)) drop-shadow(0 0 8px rgba(0,0,0,0.4))' }}>
            {icon}
        </div>
        <span className="text-xs mt-1 hidden md:block" style={{ textShadow: '0 0 4px rgba(0,0,0,0.6), 0 0 8px rgba(0,0,0,0.4)' }}>{label}</span>
    </button>
);

export default ActionButton;