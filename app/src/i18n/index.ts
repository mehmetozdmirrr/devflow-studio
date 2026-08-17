import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import tr from "./locales/tr.json";

export const SUPPORTED_LOCALES = ["en", "tr"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    tr: { translation: tr },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
  returnEmptyString: false,
});

export default i18n;
