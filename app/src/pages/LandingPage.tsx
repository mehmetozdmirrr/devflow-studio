import { Link } from "react-router";
import { useTranslation } from "react-i18next";

import { PageContainer } from "../components/layout/PageContainer";
import { buttonClasses } from "../components/ui/Button";
import { WorkflowVisual } from "./landing/ProductPreview";
import {
  AIExplainer,
  Capabilities,
  FinalCta,
  HowItWorks,
  LandingFooter,
} from "./landing/LandingSections";

export function LandingPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col">
      <section className="py-10 sm:py-14 lg:py-16">
        <PageContainer className="mx-auto grid gap-10 px-4 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div className="flex flex-col items-start gap-6">
            <h1 className="max-w-xl text-3xl font-semibold text-balance text-text sm:text-4xl lg:text-[2.75rem]">
              {t("landing.title")}
            </h1>
            <p className="max-w-xl text-lg text-muted">{t("landing.subtitle")}</p>
            <div className="flex flex-wrap gap-3">
              <Link to="/projects/new" className={buttonClasses("primary", "md")}>
                {t("landing.createProject")}
              </Link>
              <Link to="/catalog" className={buttonClasses("secondary", "md")}>
                {t("landing.browseCatalog")}
              </Link>
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <WorkflowVisual />
          </div>
        </PageContainer>
      </section>

      <HowItWorks />
      <Capabilities />
      <AIExplainer />
      <FinalCta />
      <LandingFooter />
    </div>
  );
}
