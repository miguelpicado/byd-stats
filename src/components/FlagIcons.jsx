import React from 'react';

export const GaliciaFlag = ({ className }) => (
    <svg viewBox="0 0 640 480" className={className} xmlns="http://www.w3.org/2000/svg">
        <rect width="640" height="480" fill="white" />
        <path d="M0,0 L0,160 L427,480 L640,480 L640,320 L213,0 Z" fill="#0092E6" />
    </svg>
);

export const CataloniaFlag = ({ className }) => (
    <svg viewBox="0 0 640 480" className={className} xmlns="http://www.w3.org/2000/svg">
        <rect width="640" height="480" fill="#FFED00" />
        <rect y="48" width="640" height="48" fill="#DA121A" />
        <rect y="144" width="640" height="48" fill="#DA121A" />
        <rect y="240" width="640" height="48" fill="#DA121A" />
        <rect y="336" width="640" height="48" fill="#DA121A" />
    </svg>
);

export const BasqueFlag = ({ className }) => (
    <svg viewBox="0 0 640 480" className={className} xmlns="http://www.w3.org/2000/svg">
        <path fill="#d52b1e" d="M0 0h640v480H0z" />
        <path fill="#fff" d="M0 200h640v80H0z" />
        <path fill="#fff" d="M280 0h80v480h-80z" />
        <path fill="#009b48" d="m0 0 640 480h-80L0 80z" />
        <path fill="#009b48" d="M560 0 0 420v60L640 60V0z" />
    </svg>
);
