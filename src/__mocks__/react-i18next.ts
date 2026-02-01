export const useTranslation = () => ({
    t: (key: string) => key,
    i18n: {
        changeLanguage: () => Promise.resolve(),
        language: 'en'
    }
});

export const initReactI18next = {
    type: '3rdParty',
    init: () => { }
};

export const I18nextProvider = ({ children }: { children: React.ReactNode }) => children;
