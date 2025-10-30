import React from 'react';

interface ActionButtonProps {
    icon: React.ReactElement;
    label: string;
    onClick?: () => void;
    isActive?: boolean;
    activeColor?: string;
}

const ActionButton = ({ icon, label, onClick, isActive = false, activeColor = 'text-red-500' }: ActionButtonProps) => (
    <button 
        className={`flex flex-col items-center justify-center p-2 md:p-2 rounded-lg active:scale-95 transition-all duration-200 touch-manipulation ${
            isActive ? activeColor : 'text-white/90 hover:text-white active:bg-white/10'
        }`} 
        title={label}
        onClick={onClick}
        style={{
            minWidth: '56px',
            minHeight: '56px',
            WebkitTapHighlightColor: 'transparent'
        }}
    >
        <div style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.6)) drop-shadow(0 0 8px rgba(0,0,0,0.4))' }}>
            {icon}
        </div>
        <span className="text-[10px] md:text-xs mt-0.5 md:mt-1 font-medium" style={{ textShadow: '0 0 4px rgba(0,0,0,0.6), 0 0 8px rgba(0,0,0,0.4)' }}>{label}</span>
    </button>
);

export default ActionButton;