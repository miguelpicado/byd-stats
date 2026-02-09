import React from 'react';

interface SkeletonProps {
    className?: string;
    width?: string | number;
    height?: string | number;
    circle?: boolean;
    style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
    className = '',
    width,
    height,
    circle = false,
    style
}) => {
    const baseStyles: React.CSSProperties = {
        width: width,
        height: height,
        borderRadius: circle ? '50%' : '0.375rem', // Default to rounded-md
        ...style
    };

    return (
        <div
            className={`animate-pulse bg-slate-200 dark:bg-slate-700 ${className}`}
            style={baseStyles}
            role="status"
            aria-label="Loading..."
        />
    );
};
