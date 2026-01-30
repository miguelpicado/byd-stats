import React from 'react';

/**
 * Fallback component shown while lazy-loaded tabs are loading.
 * Used with React.Suspense for code-split tab components.
 */
const TabFallback: React.FC = () => (
    /* 
       Invisible fallback to prevent layout thrashing during lazy load / transition 
       but avoid visual flickering of "Loading..." text during fast preloads.
       Maintains a minimum height to prevent collapse.
    */
    <div className="w-full h-full min-h-[200px] flex items-center justify-center opacity-0 pointer-events-none">
        <div className="w-8 h-8" />
    </div>
);

export default TabFallback;
