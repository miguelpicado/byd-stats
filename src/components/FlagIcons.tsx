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

export const SpainFlag = ({ className }) => (
    <svg viewBox="0 0 640 480" className={className} xmlns="http://www.w3.org/2000/svg">
        <rect width="640" height="480" fill="#AA151B" />
        <rect width="640" height="240" y="120" fill="#F1BF00" />
    </svg>
);

export const UKFlag = ({ className }) => (
    <svg viewBox="0 0 640 480" className={className} xmlns="http://www.w3.org/2000/svg">
        <path fill="#012169" d="M0 0h640v480H0z" />
        <path fill="#FFF" d="M75 0 0 53v28L640 480h-87l-75-53v28L0 0h75zM640 0v53L0 480v-28L640 0z" />
        <path fill="#C8102E" d="m424 286 216 144v50L424 286zm-208-92L0 50V0l216 194zM0 480l216-144v-50L0 480zm640 0L424 286l216-144v144z" />
        <path fill="#FFF" d="M250 0h140v480H250zM0 170h640v140H0z" />
        <path fill="#C8102E" d="M280 0h80v480h-80zM0 200h640v80H0z" />
    </svg>
);

export const PortugalFlag = ({ className }) => (
    <svg viewBox="0 0 640 480" className={className} xmlns="http://www.w3.org/2000/svg">
        <rect width="640" height="480" fill="#C60C30" />
        <rect width="240" height="480" fill="#006600" />
        <circle cx="240" cy="240" r="80" fill="#FFC400" />
        <circle cx="240" cy="240" r="70" fill="#FFF" />
        <path fill="#006600" d="M190 240 a50 50 0 0 1 100 0 h-10 a40 40 0 0 0 -80 0 z" />
        <rect x="220" y="190" width="40" height="50" fill="#C60C30" />
    </svg>
);


