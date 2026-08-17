import { Link } from "react-router";
import { useTranslation } from "react-i18next";

import { PageContainer } from "../../components/layout/PageContainer";
import { buttonClasses } from "../../components/ui/Button";

const STEP_KEYS = ["step1", "step2", "step3", "step4"] as const;
const CAPABILITY_KEYS = ["localFirst", "deterministic", "catalog", "optionalAI"] as const;

export function HowItWorks() {
  const { t } = useTranslation();
  return (
    <section className="border-t border-border bg-surface/40 py-12">
      <PageContainer className="mx-auto flex flex-col gap-6 px-4">
        <h2 className="text-xl font-semibold text-text">{t("landing.howItWorks.heading")}</h2>
        <ol className="flex flex-col gap-4 sm:grid sm:grid-cols-2 sm:gap-4 lg:flex lg:flex-row lg:gap-0">
          {STEP_KEYS.map((key, index) => (
            <li key={key} className="flex items-stretch lg:flex-1">
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className="mt-8 hidden h-px w-6 shrink-0 self-start bg-border lg:block"
                />
              )}
              <div className="flex flex-1 flex-col gap-2 rounded-lg border border-border bg-surface p-4">
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-interactive text-sm font-semibold text-on-primary"
                >
                  {index + 1}
                </span>
                <p className="font-medium text-text">{t(`landing.howItWorks.${key}.title`)}</p>
                <p className="text-sm text-muted">{t(`landing.howItWorks.${key}.body`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </PageContainer>
    </section>
  );
}

export function Capabilities() {
  const { t } = useTranslation();
  return (
    <section className="border-t border-border py-12">
      <PageContainer className="mx-auto flex flex-col gap-6 px-4">
        <h2 className="text-xl font-semibold text-text">{t("landing.capabilities.heading")}</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CAPABILITY_KEYS.map((key) => (
            <li
              key={key}
              className="flex flex-col gap-2 rounded-lg border border-border border-l-2 border-l-accent bg-background p-4"
            >
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
              <p className="font-medium text-text">{t(`landing.capabilities.${key}.title`)}</p>
              <p className="text-sm text-muted">{t(`landing.capabilities.${key}.body`)}</p>
            </li>
          ))}
        </ul>
      </PageContainer>
    </section>
  );
}

export function AIExplainer() {
  const { t } = useTranslation();
  return (
    <section className="border-t border-border bg-surface/40 py-12">
      <PageContainer className="mx-auto flex flex-col gap-6 px-4">
        <h2 className="text-center text-xl font-semibold text-text">
          {t("landing.aiExplainer.heading")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
            <p className="font-medium text-text">
              {t("landing.aiExplainer.deterministic.heading")}
            </p>
            <ul className="flex flex-col gap-1 text-sm text-muted">
              <li>{t("landing.aiExplainer.deterministic.item1")}</li>
              <li>{t("landing.aiExplainer.deterministic.item2")}</li>
              <li>{t("landing.aiExplainer.deterministic.item3")}</li>
            </ul>
          </div>
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
            <p className="font-medium text-text">{t("landing.aiExplainer.optionalAI.heading")}</p>
            <ul className="flex flex-col gap-1 text-sm text-muted">
              <li>{t("landing.aiExplainer.optionalAI.item1")}</li>
              <li>{t("landing.aiExplainer.optionalAI.item2")}</li>
              <li>{t("landing.aiExplainer.optionalAI.item3")}</li>
            </ul>
          </div>
        </div>
      </PageContainer>
    </section>
  );
}

export function FinalCta() {
  const { t } = useTranslation();
  return (
    <section className="border-t border-border bg-primary/5 py-14">
      <PageContainer className="mx-auto flex flex-col items-center gap-3 px-4 text-center">
        <h2 className="text-xl font-semibold text-text">{t("landing.finalCta.heading")}</h2>
        <p className="max-w-md text-sm text-muted">{t("landing.finalCta.body")}</p>
        <Link to="/projects/new" className={`mt-2 ${buttonClasses("primary", "md")}`}>
          {t("landing.createProject")}
        </Link>
      </PageContainer>
    </section>
  );
}

export function LandingFooter() {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-border py-6">
      <PageContainer className="mx-auto px-4 text-center text-xs text-muted">
        {t("landing.footer.text")}
      </PageContainer>
    </footer>
  );
}
