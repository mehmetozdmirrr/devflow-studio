import "@testing-library/jest-dom/vitest";
import { toHaveNoViolations } from "jest-axe";
import { afterEach, expect } from "vitest";

import i18n from "../i18n";

expect.extend(toHaveNoViolations);

if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

afterEach(async () => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  if (i18n.language !== "en") {
    await i18n.changeLanguage("en");
  }
});
