import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

export const languages = [
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'pt', name: 'Português', flag: '🇵🇹' },
    { code: 'gl', name: 'Galego', flag: '' }, // Uses custom SVG
    { code: 'ca', name: 'Català', flag: '' }, // Uses custom SVG
    { code: 'eu', name: 'Euskara', flag: '' } // Uses custom SVG
];

i18n
    .use(HttpBackend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: 'es',
        supportedLngs: ['es', 'en', 'pt', 'gl', 'ca', 'eu'],
        backend: {
            loadPath: '/locales/{{lng}}.json'
        },
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
