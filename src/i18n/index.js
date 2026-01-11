import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import es from './locales/es.json';
import en from './locales/en.json';
import pt from './locales/pt.json';
import gl from './locales/gl.json';
import ca from './locales/ca.json';
import eu from './locales/eu.json';

export const languages = [
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'pt', name: 'Português', flag: '🇵🇹' },
    { code: 'gl', name: 'Galego', flag: '' }, // Uses custom SVG
    { code: 'ca', name: 'Català', flag: '' }, // Uses custom SVG
    { code: 'eu', name: 'Euskara', flag: '' } // Uses custom SVG
];

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            es: { translation: es },
            en: { translation: en },
            pt: { translation: pt },
            gl: { translation: gl },
            ca: { translation: ca },
            eu: { translation: eu }
        },
        fallbackLng: 'es',
        detection: {
            order: ['localStorage', 'navigator'],
            lookupLocalStorage: 'byd_language',
            caches: ['localStorage']
        },
        interpolation: {
            escapeValue: false
        }
    });

export default i18n;
