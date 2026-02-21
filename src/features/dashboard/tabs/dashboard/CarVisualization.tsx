import React, { useState } from 'react';
import { useCar } from '@/context/CarContext';
import { bydWakeVehicle } from '@/services/bydApi';
import toast from 'react-hot-toast';

const CarVisualization: React.FC = () => {
    const { activeCar } = useCar();
    const [tapCount, setTapCount] = useState(0);
    const [lastTap, setLastTap] = useState(0);

    const handleImageClick = () => {
        const now = Date.now();
        const vin = activeCar?.vin;

        if (now - lastTap > 2000) {
            setTapCount(1);
        } else {
            const newCount = tapCount + 1;
            if (newCount >= 10) {
                if (vin) {
                    toast.promise(bydWakeVehicle(vin), {
                        loading: 'Waking car...',
                        success: 'Force update command sent',
                        error: 'Failed to wake car'
                    });
                }
                setTapCount(0);
            } else {
                setTapCount(newCount);
            }
        }
        setLastTap(now);
    };

    return (
        <div
            className="w-full h-52 relative flex items-center justify-center py-1 shrink-0 cursor-pointer"
            onClick={handleImageClick}
        >
            <img
                src="/assets/byd_seal.png?t=1"
                alt="BYD Seal 2024"
                className="w-full h-full object-contain select-none scale-[0.8] relative z-10"
                onError={(e) => {
                    e.currentTarget.parentElement?.classList.add('border-2', 'border-red-500');
                    console.error('Image failed to load:', e.currentTarget.src);
                }}
            />
            {/* Ground shadow */}
            <div
                className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[85%] h-6 rounded-[50%] blur-sm opacity-60"
                style={{
                    background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.4) 30%, rgba(0,0,0,0.1) 60%, transparent 80%)'
                }}
            />
        </div>
    );
};

export default CarVisualization;
