import React from 'react';

const CarVisualization: React.FC = () => {
    return (
        <div className="w-full h-52 relative flex items-center justify-center py-1 shrink-0">
            <img
                src="/assets/byd_seal.png?t=1"
                alt="BYD Seal 2024"
                className="w-full h-full object-contain drop-shadow-2xl"
                onError={(e) => {
                    // e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement?.classList.add('border-2', 'border-red-500');
                    console.error('Image failed to load:', e.currentTarget.src);
                }}
            />
        </div>
    );
};

export default CarVisualization;
