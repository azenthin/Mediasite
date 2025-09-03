import React from 'react';

interface ActionButtonProps {
    icon: React.ReactElement;
    label: string;
}

const ActionButton = ({ icon, label }: ActionButtonProps) => (
    <button className="flex flex-col items-center justify-center p-1 md:p-2 text-white/90 hover:text-white transition-colors duration-200" title={label}>
        {icon}
        <span className="text-xs mt-1 hidden md:block">{label}</span>
    </button>
);

export default ActionButton;