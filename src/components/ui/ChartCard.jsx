import React, { useState, useEffect } from 'react';

const ChartCard = React.memo(({ title, children, className = "", isCompact, animationKey }) => {
    const [renderChild, setRenderChild] = useState(true);

    useEffect(() => {
        if (animationKey !== undefined) {
            setRenderChild(false);
            const timer = requestAnimationFrame(() => {
                setRenderChild(true);
            });
            return () => cancelAnimationFrame(timer);
        }
    }, [animationKey]);

    return (
        <div className={`bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/50 ${className} ${isCompact ? 'p-2' : 'p-4 sm:p-6'}`}>
            {title && <h3 className={`font-semibold text-slate-900 dark:text-white ${isCompact ? 'text-xs sm:text-sm mb-1.5' : 'text-base sm:text-lg mb-3 sm:mb-4'}`}>{title}</h3>}
            <div key={animationKey} className="w-full relative">
                {renderChild ? children : <div className="w-full h-full" />}
            </div>
        </div>
    );
});

export default ChartCard;
