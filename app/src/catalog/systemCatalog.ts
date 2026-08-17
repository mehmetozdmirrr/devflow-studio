import type {
  AgentDetails,
  ArchitectureDetails,
  CatalogItem,
  CatalogItemBase,
  CatalogRelation,
  DocumentTemplateDetails,
  DomainDetails,
  IntegrationDetails,
  QualityGateDetails,
  RecommendationMetadata,
  SkillDetails,
  TechnologyDetails,
} from "@contracts/catalog";
import type { LocalizedText } from "@contracts/common";

import { SYSTEM_DOMAINS } from "../domain/domains";

/**
 * Curated V1 subset of the system catalog (per DEC-023): ~3 items per non-domain kind across all
 * 19 `CatalogItemKind`s, covering every kind defined by `catalog/seed/catalog-kinds.json` and the
 * `contracts/types/catalog.ts` contract. This is intentionally not the eventual 60-80 item,
 * source-cited technology catalog described in `catalog/seed/README.md` — no version numbers,
 * prices, or performance claims are asserted (`currentMajorVersion` is omitted everywhere) since
 * this session has no web-research access to verify changeable facts. Relation/recommendation
 * content (requires/recommends/conflicts-with/avoidWhen reasons) is curatorial product guidance,
 * not an external factual claim.
 */
const TS = "2026-08-14T00:00:00.000Z";

function loc(en: string, tr: string): LocalizedText {
  return { en, tr };
}

function rec(overrides: Partial<RecommendationMetadata> = {}): RecommendationMetadata {
  return {
    supportedProfiles: ["beginner", "intermediate", "advanced", "team"],
    supportedScales: ["prototype", "mvp", "standard", "enterprise"],
    preferredDomainIds: [],
    requirementTags: [],
    baseScore: 50,
    tokenImpact: "medium",
    setupEffort: "medium",
    reasons: [],
    avoidWhen: [],
    ...overrides,
  };
}

function relation(
  type: CatalogRelation["type"],
  targetId: string,
  reason: LocalizedText,
  severity: CatalogRelation["severity"] = "info",
): CatalogRelation {
  return { type, targetId, reason, severity };
}

function base(
  id: string,
  name: string,
  shortDescription: LocalizedText,
  description: LocalizedText,
  domainIds: string[],
  tags: string[],
): Omit<CatalogItemBase<never, never>, "kind" | "details"> {
  return {
    id,
    schemaVersion: 1,
    itemVersion: "1.0.0",
    name,
    slug: id,
    shortDescription,
    description,
    domainIds,
    tags,
    supportedPlatforms: ["web"],
    difficulty: "intermediate",
    maturity: "stable",
    origin: "system",
    verification: "verified",
    relations: [],
    recommendation: rec(),
    createdAt: TS,
    updatedAt: TS,
  };
}

// ---------------------------------------------------------------------------
// domain / subdomain
// ---------------------------------------------------------------------------

const domainItems: CatalogItemBase<"domain", DomainDetails>[] = SYSTEM_DOMAINS.map((domain) => ({
  ...base(domain.id, domain.name.en, domain.name, domain.name, [domain.id], domain.tags),
  kind: "domain",
  difficulty: "beginner",
  details: { defaultQuestionSetIds: [] },
}));

const subdomainItems: CatalogItemBase<"subdomain", DomainDetails>[] = [
  {
    ...base(
      "subdomain-web-frontend",
      "Web Frontend",
      loc("Browser-rendered user interfaces.", "Tarayıcıda oluşturulan kullanıcı arayüzleri."),
      loc(
        "Client-side UI work within the Web domain, distinct from backend/API concerns.",
        "Web alanı içinde, backend/API konularından ayrı istemci tarafı arayüz çalışması.",
      ),
      ["domain-web"],
      ["frontend", "ui"],
    ),
    kind: "subdomain",
    difficulty: "beginner",
    details: { parentDomainId: "domain-web", defaultQuestionSetIds: [] },
  },
  {
    ...base(
      "subdomain-mobile-cross-platform",
      "Cross-Platform Mobile",
      loc(
        "Single codebase targeting iOS and Android.",
        "Tek kod tabanıyla iOS ve Android hedefleme.",
      ),
      loc(
        "Mobile subdomain for teams that want one codebase across iOS/Android instead of two native apps.",
        "iOS/Android için iki ayrı native uygulama yerine tek kod tabanı isteyen ekipler için mobil alt alanı.",
      ),
      ["domain-mobile"],
      ["cross-platform"],
    ),
    kind: "subdomain",
    difficulty: "intermediate",
    details: { parentDomainId: "domain-mobile", defaultQuestionSetIds: [] },
  },
  {
    ...base(
      "subdomain-cloud-devops-ci-cd",
      "CI/CD Pipelines",
      loc(
        "Automated build, test, and deploy pipelines.",
        "Otomatik derleme, test ve dağıtım hatları.",
      ),
      loc(
        "Cloud/DevOps subdomain focused specifically on continuous integration and delivery pipelines.",
        "Cloud/DevOps alanı içinde özellikle sürekli entegrasyon ve dağıtım hatlarına odaklanan alt alan.",
      ),
      ["domain-cloud-devops"],
      ["ci-cd", "automation"],
    ),
    kind: "subdomain",
    difficulty: "intermediate",
    details: { parentDomainId: "domain-cloud-devops", defaultQuestionSetIds: [] },
  },
];

// ---------------------------------------------------------------------------
// language
// ---------------------------------------------------------------------------

const languageItems: CatalogItemBase<"language", TechnologyDetails>[] = [
  {
    ...base(
      "language-typescript",
      "TypeScript",
      loc("Typed superset of JavaScript.", "JavaScript'in tip destekli üst kümesi."),
      loc(
        "A statically typed language that compiles to JavaScript, widely used for web/backend/tooling projects.",
        "JavaScript'e derlenen, statik tip denetimli bir dil; web/backend/araç projelerinde yaygın kullanılır.",
      ),
      ["domain-web", "domain-backend-api", "domain-desktop", "domain-browser-extension"],
      ["typed", "javascript-ecosystem"],
    ),
    kind: "language",
    difficulty: "beginner",
    recommendation: rec({
      preferredDomainIds: ["domain-web", "domain-backend-api"],
      requirementTags: ["type-safety"],
      baseScore: 70,
      tokenImpact: "low",
      setupEffort: "low",
      reasons: [
        loc(
          "Catches type errors before runtime.",
          "Çalışma zamanından önce tip hatalarını yakalar.",
        ),
      ],
    }),
    details: { packageName: "typescript", runtimeRequirements: ["node"] },
  },
  {
    ...base(
      "language-python",
      "Python",
      loc(
        "General-purpose, readable scripting/application language.",
        "Genel amaçlı, okunabilir betik/uygulama dili.",
      ),
      loc(
        "Widely used for backend services, data/ML tooling, and automation scripts.",
        "Backend servisleri, veri/ML araçları ve otomasyon betikleri için yaygın kullanılır.",
      ),
      ["domain-backend-api", "domain-data", "domain-ai-ml", "domain-automation-cli"],
      ["scripting", "data"],
    ),
    kind: "language",
    difficulty: "beginner",
    recommendation: rec({
      preferredDomainIds: ["domain-data", "domain-ai-ml", "domain-automation-cli"],
      requirementTags: ["data-processing"],
      baseScore: 65,
      setupEffort: "low",
      reasons: [
        loc("Large ecosystem for data/ML/automation.", "Veri/ML/otomasyon için geniş ekosistem."),
      ],
    }),
    details: { runtimeRequirements: ["cpython-3.x"] },
  },
  {
    ...base(
      "language-go",
      "Go",
      loc(
        "Compiled, concurrent systems/backend language.",
        "Derlenen, eşzamanlı sistem/backend dili.",
      ),
      loc(
        "A compiled language emphasizing simplicity and built-in concurrency, common for backend/CLI/infra tooling.",
        "Sadeliği ve yerleşik eşzamanlılığı öne çıkaran derlenen bir dil; backend/CLI/altyapı araçlarında yaygındır.",
      ),
      ["domain-backend-api", "domain-cloud-devops", "domain-automation-cli"],
      ["compiled", "concurrency"],
    ),
    kind: "language",
    difficulty: "intermediate",
    recommendation: rec({
      preferredDomainIds: ["domain-backend-api", "domain-cloud-devops"],
      baseScore: 55,
      setupEffort: "medium",
      reasons: [loc("Strong fit for infra/CLI tooling.", "Altyapı/CLI araçları için güçlü uyum.")],
    }),
    details: { runtimeRequirements: ["go-toolchain"] },
  },
];

// ---------------------------------------------------------------------------
// framework
// ---------------------------------------------------------------------------

const frameworkItems: CatalogItemBase<"framework", TechnologyDetails>[] = [
  {
    ...base(
      "framework-react",
      "React",
      loc("Component-based UI library/framework.", "Bileşen tabanlı arayüz kütüphanesi/çatısı."),
      loc(
        "A declarative, component-based library for building web user interfaces.",
        "Web kullanıcı arayüzleri oluşturmak için bildirimsel, bileşen tabanlı bir kütüphane.",
      ),
      ["domain-web"],
      ["ui", "component-based"],
    ),
    kind: "framework",
    difficulty: "beginner",
    relations: [
      relation(
        "recommends",
        "language-typescript",
        loc(
          "Typed components catch prop/state errors earlier.",
          "Tip destekli bileşenler prop/state hatalarını erken yakalar.",
        ),
      ),
    ],
    recommendation: rec({
      preferredDomainIds: ["domain-web"],
      requirementTags: ["interactive-ui"],
      baseScore: 75,
      setupEffort: "low",
      reasons: [
        loc(
          "Most common choice for interactive web UIs.",
          "Etkileşimli web arayüzleri için en yaygın seçim.",
        ),
      ],
    }),
    details: { packageName: "react", runtimeRequirements: ["node"] },
  },
  {
    ...base(
      "framework-nextjs",
      "Next.js",
      loc("Full-stack React application framework.", "Full-stack React uygulama çatısı."),
      loc(
        "A React framework adding routing, server rendering, and API routes on top of React.",
        "React üzerine yönlendirme, sunucu tarafı render ve API rotaları ekleyen bir React çatısı.",
      ),
      ["domain-web"],
      ["full-stack", "ssr"],
    ),
    kind: "framework",
    difficulty: "intermediate",
    relations: [
      relation(
        "requires",
        "framework-react",
        loc("Next.js is built on top of React.", "Next.js, React üzerine inşa edilmiştir."),
        "error",
      ),
      relation(
        "recommends",
        "language-typescript",
        loc(
          "Recommended for larger Next.js apps.",
          "Daha büyük Next.js uygulamaları için önerilir.",
        ),
      ),
    ],
    recommendation: rec({
      preferredDomainIds: ["domain-web"],
      requirementTags: ["server-rendering", "full-stack"],
      baseScore: 60,
      setupEffort: "medium",
      reasons: [
        loc(
          "Adds routing/SSR/API routes without a separate backend.",
          "Ayrı bir backend olmadan yönlendirme/SSR/API rotaları ekler.",
        ),
      ],
      avoidWhen: [
        loc(
          "A pure static single-page app is sufficient.",
          "Sade bir statik tek sayfa uygulaması yeterliyse.",
        ),
      ],
    }),
    details: { packageName: "next", runtimeRequirements: ["node", "react"] },
  },
  {
    ...base(
      "framework-express",
      "Express",
      loc("Minimal Node.js HTTP/API framework.", "Minimal Node.js HTTP/API çatısı."),
      loc(
        "An unopinionated, minimal web framework for building HTTP APIs on Node.js.",
        "Node.js üzerinde HTTP API'leri oluşturmak için sade, görüş bildirmeyen bir web çatısı.",
      ),
      ["domain-backend-api"],
      ["http", "api"],
    ),
    kind: "framework",
    difficulty: "beginner",
    recommendation: rec({
      preferredDomainIds: ["domain-backend-api"],
      requirementTags: ["rest-api"],
      baseScore: 55,
      setupEffort: "low",
      reasons: [
        loc(
          "Simple, well-known choice for a REST API.",
          "Bir REST API için basit, iyi bilinen bir seçim.",
        ),
      ],
    }),
    details: { packageName: "express", runtimeRequirements: ["node"] },
  },
];

// ---------------------------------------------------------------------------
// library
// ---------------------------------------------------------------------------

const libraryItems: CatalogItemBase<"library", TechnologyDetails>[] = [
  {
    ...base(
      "library-axios",
      "Axios",
      loc("Promise-based HTTP client.", "Promise tabanlı HTTP istemcisi."),
      loc(
        "A promise-based HTTP client for the browser and Node.js.",
        "Tarayıcı ve Node.js için promise tabanlı bir HTTP istemcisi.",
      ),
      ["domain-web", "domain-backend-api"],
      ["http-client"],
    ),
    kind: "library",
    difficulty: "beginner",
    recommendation: rec({ baseScore: 45, setupEffort: "low" }),
    details: { packageName: "axios", runtimeRequirements: [] },
  },
  {
    ...base(
      "library-zod",
      "Zod",
      loc("TypeScript-first schema validation.", "TypeScript öncelikli şema doğrulama."),
      loc(
        "A schema declaration and validation library with static type inference for TypeScript.",
        "TypeScript için statik tip çıkarımı sunan bir şema tanımlama ve doğrulama kütüphanesi.",
      ),
      ["domain-web", "domain-backend-api"],
      ["validation", "schema"],
    ),
    kind: "library",
    difficulty: "beginner",
    relations: [
      relation(
        "recommends",
        "language-typescript",
        loc(
          "Type inference only applies in a TypeScript project.",
          "Tip çıkarımı yalnızca bir TypeScript projesinde geçerlidir.",
        ),
      ),
    ],
    recommendation: rec({
      requirementTags: ["input-validation"],
      baseScore: 50,
      setupEffort: "low",
    }),
    details: { packageName: "zod", runtimeRequirements: [] },
  },
  {
    ...base(
      "library-lodash",
      "Lodash",
      loc("General-purpose utility functions.", "Genel amaçlı yardımcı fonksiyonlar."),
      loc(
        "A collection of utility functions for common array/object/string operations.",
        "Yaygın dizi/nesne/metin işlemleri için yardımcı fonksiyon koleksiyonu.",
      ),
      ["domain-web", "domain-backend-api"],
      ["utility"],
    ),
    kind: "library",
    difficulty: "beginner",
    recommendation: rec({
      baseScore: 30,
      setupEffort: "low",
      avoidWhen: [
        loc(
          "Modern JS array/object methods already cover the need.",
          "İhtiyaç zaten modern JS dizi/nesne metotlarıyla karşılanıyorsa.",
        ),
      ],
    }),
    details: { packageName: "lodash", runtimeRequirements: [] },
  },
];

// ---------------------------------------------------------------------------
// ui-system
// ---------------------------------------------------------------------------

const uiSystemItems: CatalogItemBase<"ui-system", TechnologyDetails>[] = [
  {
    ...base(
      "ui-system-tailwind",
      "Tailwind CSS",
      loc("Utility-first CSS framework.", "Yardımcı sınıf öncelikli CSS çatısı."),
      loc(
        "A utility-first CSS framework for building custom designs without leaving markup.",
        "İşaretlemeden ayrılmadan özel tasarımlar oluşturmak için yardımcı sınıf öncelikli bir CSS çatısı.",
      ),
      ["domain-web"],
      ["css", "utility-first"],
    ),
    kind: "ui-system",
    difficulty: "beginner",
    recommendation: rec({ preferredDomainIds: ["domain-web"], baseScore: 55, setupEffort: "low" }),
    details: { packageName: "tailwindcss", runtimeRequirements: [] },
  },
  {
    ...base(
      "ui-system-mui",
      "Material UI",
      loc(
        "React component library implementing Material Design.",
        "Material Design'ı uygulayan React bileşen kütüphanesi.",
      ),
      loc(
        "A React component library implementing Google's Material Design system.",
        "Google'ın Material Design sistemini uygulayan bir React bileşen kütüphanesi.",
      ),
      ["domain-web"],
      ["component-library"],
    ),
    kind: "ui-system",
    difficulty: "beginner",
    relations: [
      relation(
        "requires",
        "framework-react",
        loc("MUI components are React components.", "MUI bileşenleri React bileşenleridir."),
        "error",
      ),
    ],
    recommendation: rec({
      preferredDomainIds: ["domain-web"],
      baseScore: 45,
      setupEffort: "medium",
    }),
    details: { packageName: "@mui/material", runtimeRequirements: ["react"] },
  },
  {
    ...base(
      "ui-system-shadcn",
      "shadcn/ui",
      loc(
        "Copy-in accessible component patterns for Tailwind.",
        "Tailwind için kopyalanabilir erişilebilir bileşen kalıpları.",
      ),
      loc(
        "A collection of accessible, unstyled-by-default component patterns meant to be copied into a Tailwind project rather than installed as a black-box dependency.",
        "Bağımsız bir bağımlılık olarak kurulmak yerine bir Tailwind projesine kopyalanmak üzere tasarlanmış, erişilebilir bileşen kalıpları koleksiyonu.",
      ),
      ["domain-web"],
      ["component-patterns"],
    ),
    kind: "ui-system",
    difficulty: "intermediate",
    relations: [
      relation(
        "requires",
        "ui-system-tailwind",
        loc(
          "Patterns are written against Tailwind utility classes.",
          "Kalıplar Tailwind yardımcı sınıfları temel alınarak yazılmıştır.",
        ),
        "error",
      ),
    ],
    recommendation: rec({ baseScore: 40, setupEffort: "medium" }),
    details: { runtimeRequirements: ["tailwindcss"] },
  },
];

// ---------------------------------------------------------------------------
// database
// ---------------------------------------------------------------------------

const databaseItems: CatalogItemBase<"database", TechnologyDetails>[] = [
  {
    ...base(
      "database-postgresql",
      "PostgreSQL",
      loc("Open-source relational database.", "Açık kaynak ilişkisel veritabanı."),
      loc(
        "A general-purpose open-source relational database with strong consistency guarantees.",
        "Güçlü tutarlılık garantileri sunan genel amaçlı, açık kaynak bir ilişkisel veritabanı.",
      ),
      ["domain-backend-api", "domain-data"],
      ["relational", "sql"],
    ),
    kind: "database",
    difficulty: "intermediate",
    recommendation: rec({
      preferredDomainIds: ["domain-backend-api"],
      baseScore: 60,
      setupEffort: "medium",
    }),
    details: { runtimeRequirements: ["postgres-server"] },
  },
  {
    ...base(
      "database-mongodb",
      "MongoDB",
      loc("Document-oriented NoSQL database.", "Doküman tabanlı NoSQL veritabanı."),
      loc(
        "A document-oriented database storing flexible, JSON-like records.",
        "Esnek, JSON benzeri kayıtları saklayan doküman tabanlı bir veritabanı.",
      ),
      ["domain-backend-api"],
      ["nosql", "document-store"],
    ),
    kind: "database",
    difficulty: "intermediate",
    recommendation: rec({ baseScore: 50, setupEffort: "medium" }),
    details: { runtimeRequirements: ["mongodb-server"] },
  },
  {
    ...base(
      "database-sqlite",
      "SQLite",
      loc(
        "Embedded, file-based relational database.",
        "Gömülü, dosya tabanlı ilişkisel veritabanı.",
      ),
      loc(
        "A serverless, file-based relational database well suited to prototypes, local-first apps, and embedded use.",
        "Prototipler, yerel öncelikli uygulamalar ve gömülü kullanım için uygun, sunucusuz ve dosya tabanlı bir ilişkisel veritabanı.",
      ),
      ["domain-backend-api", "domain-desktop", "domain-iot-embedded"],
      ["relational", "embedded"],
    ),
    kind: "database",
    difficulty: "beginner",
    recommendation: rec({
      supportedScales: ["prototype", "mvp"],
      baseScore: 40,
      setupEffort: "low",
      avoidWhen: [
        loc(
          "Multiple concurrent writers at production scale are expected.",
          "Üretim ölçeğinde çok sayıda eşzamanlı yazıcı bekleniyorsa.",
        ),
      ],
    }),
    details: { runtimeRequirements: [] },
  },
];

// ---------------------------------------------------------------------------
// architecture
// ---------------------------------------------------------------------------

const architectureItems: CatalogItemBase<"architecture", ArchitectureDetails>[] = [
  {
    ...base(
      "architecture-layered",
      "Layered Architecture",
      loc("Presentation/application/domain/data layers.", "Sunum/uygulama/alan/veri katmanları."),
      loc(
        "Organizes code into presentation, application, domain, and data layers with dependencies flowing inward.",
        "Kodu sunum, uygulama, alan ve veri katmanlarına ayırır; bağımlılıklar içe doğru akar.",
      ),
      [],
      ["layered", "separation-of-concerns"],
    ),
    kind: "architecture",
    difficulty: "beginner",
    recommendation: rec({ baseScore: 55, setupEffort: "low" }),
    details: {
      suitableFor: ["small-to-medium web/backend projects"],
      tradeoffs: [
        loc(
          "Simple to learn; can become a large shared domain layer over time.",
          "Öğrenmesi kolaydır; zamanla büyük, paylaşılan bir alan katmanına dönüşebilir.",
        ),
      ],
      requiredDocumentIds: [],
    },
  },
  {
    ...base(
      "architecture-hexagonal",
      "Hexagonal (Ports & Adapters)",
      loc(
        "Domain core isolated behind ports/adapters.",
        "Alan çekirdeği port/adaptör arkasında izole edilir.",
      ),
      loc(
        "Keeps a pure domain core independent of frameworks/IO, exposed only through ports implemented by adapters.",
        "Saf bir alan çekirdeğini çatı/IO'dan bağımsız tutar; yalnızca adaptörlerin uyguladığı portlar üzerinden dışa açılır.",
      ),
      [],
      ["ports-and-adapters", "testability"],
    ),
    kind: "architecture",
    difficulty: "advanced",
    recommendation: rec({
      supportedProfiles: ["advanced", "team"],
      baseScore: 45,
      setupEffort: "high",
      reasons: [
        loc(
          "Keeps domain logic testable without framework/IO dependencies.",
          "Alan mantığını çatı/IO bağımlılığı olmadan test edilebilir tutar.",
        ),
      ],
    }),
    details: {
      suitableFor: ["projects with significant, long-lived business logic"],
      tradeoffs: [
        loc(
          "More upfront structure; pays off as complexity grows.",
          "Başlangıçta daha fazla yapı gerektirir; karmaşıklık arttıkça karşılığını verir.",
        ),
      ],
      requiredDocumentIds: [],
    },
  },
  {
    ...base(
      "architecture-microservices",
      "Microservices",
      loc("Independently deployable services.", "Bağımsız dağıtılabilen servisler."),
      loc(
        "Splits a system into independently deployable services communicating over the network.",
        "Bir sistemi, ağ üzerinden iletişim kuran, bağımsız dağıtılabilen servislere böler.",
      ),
      ["domain-cloud-devops"],
      ["distributed", "scalability"],
    ),
    kind: "architecture",
    difficulty: "advanced",
    recommendation: rec({
      supportedScales: ["standard", "enterprise"],
      supportedProfiles: ["advanced", "team"],
      baseScore: 30,
      setupEffort: "high",
      avoidWhen: [
        loc(
          "Team/project size does not justify distributed-systems overhead.",
          "Ekip/proje büyüklüğü dağıtık sistem yükünü haklı çıkarmıyorsa.",
        ),
      ],
    }),
    details: {
      suitableFor: ["large teams", "independently scaled subsystems"],
      tradeoffs: [
        loc(
          "High operational overhead in exchange for independent deployability.",
          "Bağımsız dağıtılabilirlik karşılığında yüksek operasyonel yük.",
        ),
      ],
      requiredDocumentIds: [],
    },
  },
];

// ---------------------------------------------------------------------------
// state-management
// ---------------------------------------------------------------------------

const stateManagementItems: CatalogItemBase<"state-management", TechnologyDetails>[] = [
  {
    ...base(
      "state-management-zustand",
      "Zustand",
      loc("Minimal React state store.", "Minimal React durum deposu."),
      loc(
        "A small, hook-based state management library for React with minimal boilerplate.",
        "React için minimal kod tekrarı ile hook tabanlı, küçük bir durum yönetimi kütüphanesi.",
      ),
      ["domain-web"],
      ["react", "minimal"],
    ),
    kind: "state-management",
    difficulty: "beginner",
    relations: [
      relation(
        "requires",
        "framework-react",
        loc(
          "Zustand hooks are used from React components.",
          "Zustand hook'ları React bileşenlerinden kullanılır.",
        ),
        "error",
      ),
    ],
    recommendation: rec({ preferredDomainIds: ["domain-web"], baseScore: 55, setupEffort: "low" }),
    details: { packageName: "zustand", runtimeRequirements: ["react"] },
  },
  {
    ...base(
      "state-management-redux",
      "Redux Toolkit",
      loc("Opinionated, structured global state.", "Görüş bildiren, yapılandırılmış global durum."),
      loc(
        "A structured, action/reducer-based global state library with strong conventions for large apps.",
        "Büyük uygulamalar için güçlü kurallara sahip, action/reducer tabanlı, yapılandırılmış bir global durum kütüphanesi.",
      ),
      ["domain-web"],
      ["react", "structured"],
    ),
    kind: "state-management",
    difficulty: "intermediate",
    relations: [
      relation(
        "conflicts-with",
        "state-management-zustand",
        loc(
          "Running two global state libraries in the same app scope adds confusion without added benefit; pick one.",
          "Aynı uygulama kapsamında iki global durum kütüphanesi çalıştırmak fayda sağlamadan karışıklığa yol açar; birini seçin.",
        ),
        "warning",
      ),
    ],
    recommendation: rec({
      supportedScales: ["standard", "enterprise"],
      baseScore: 40,
      setupEffort: "medium",
      avoidWhen: [
        loc(
          "App state is simple enough for a minimal store.",
          "Uygulama durumu minimal bir depo için yeterince basitse.",
        ),
      ],
    }),
    details: { packageName: "@reduxjs/toolkit", runtimeRequirements: ["react"] },
  },
  {
    ...base(
      "state-management-context-api",
      "React Context API",
      loc("Built-in React state sharing.", "React'e yerleşik durum paylaşımı."),
      loc(
        "React's built-in mechanism for passing state through the component tree without prop drilling.",
        "Bileşen ağacında prop aktarımı yapmadan durum paylaşmak için React'e yerleşik mekanizma.",
      ),
      ["domain-web"],
      ["react", "built-in"],
    ),
    kind: "state-management",
    difficulty: "beginner",
    relations: [
      relation(
        "requires",
        "framework-react",
        loc("Context is a React API.", "Context bir React API'sidir."),
        "error",
      ),
    ],
    recommendation: rec({
      baseScore: 35,
      setupEffort: "low",
      avoidWhen: [
        loc(
          "State updates are frequent and shared widely (re-render cost grows).",
          "Durum güncellemeleri sık ve yaygınsa (yeniden render maliyeti artar).",
        ),
      ],
    }),
    details: { runtimeRequirements: ["react"] },
  },
];

// ---------------------------------------------------------------------------
// testing-tool
// ---------------------------------------------------------------------------

const testingToolItems: CatalogItemBase<"testing-tool", TechnologyDetails>[] = [
  {
    ...base(
      "testing-tool-vitest",
      "Vitest",
      loc("Vite-native unit test runner.", "Vite doğal birim test çalıştırıcısı."),
      loc(
        "A fast unit/component test runner built for Vite-based projects.",
        "Vite tabanlı projeler için tasarlanmış, hızlı bir birim/bileşen test çalıştırıcısı.",
      ),
      ["domain-web", "domain-backend-api"],
      ["unit", "component"],
    ),
    kind: "testing-tool",
    difficulty: "beginner",
    recommendation: rec({ baseScore: 60, setupEffort: "low" }),
    details: { packageName: "vitest", runtimeRequirements: ["node"] },
  },
  {
    ...base(
      "testing-tool-playwright",
      "Playwright",
      loc("Cross-browser end-to-end testing.", "Tarayıcılar arası uçtan uca test."),
      loc(
        "An end-to-end browser automation/testing tool covering multiple browser engines.",
        "Birden fazla tarayıcı motorunu kapsayan bir uçtan uca tarayıcı otomasyonu/test aracı.",
      ),
      ["domain-web"],
      ["e2e", "browser-automation"],
    ),
    kind: "testing-tool",
    difficulty: "intermediate",
    recommendation: rec({
      preferredDomainIds: ["domain-web"],
      baseScore: 45,
      setupEffort: "medium",
    }),
    details: { packageName: "@playwright/test", runtimeRequirements: ["node"] },
  },
  {
    ...base(
      "testing-tool-jest",
      "Jest",
      loc("General-purpose JavaScript test framework.", "Genel amaçlı JavaScript test çatısı."),
      loc(
        "A widely used JavaScript testing framework with built-in assertions, mocking, and coverage.",
        "Yerleşik doğrulama, mock ve kapsam ölçümü içeren, yaygın kullanılan bir JavaScript test çatısı.",
      ),
      ["domain-web", "domain-backend-api"],
      ["unit"],
    ),
    kind: "testing-tool",
    difficulty: "beginner",
    relations: [
      relation(
        "conflicts-with",
        "testing-tool-vitest",
        loc(
          "Two unit test runners in one project collide on CLI commands, watch mode, and config; pick one.",
          "Bir projede iki birim test çalıştırıcısı CLI komutlarında, izleme modunda ve yapılandırmada çakışır; birini seçin.",
        ),
        "error",
      ),
    ],
    recommendation: rec({
      baseScore: 35,
      setupEffort: "low",
      avoidWhen: [
        loc(
          "The project is already Vite-based, where Vitest avoids a second config.",
          "Proje zaten Vite tabanlıysa Vitest ikinci bir yapılandırmayı önler.",
        ),
      ],
    }),
    details: { packageName: "jest", runtimeRequirements: ["node"] },
  },
];

// ---------------------------------------------------------------------------
// security-tool
// ---------------------------------------------------------------------------

const securityToolItems: CatalogItemBase<"security-tool", TechnologyDetails>[] = [
  {
    ...base(
      "security-tool-eslint-plugin-security",
      "eslint-plugin-security",
      loc(
        "Static lint rules for common Node.js risk patterns.",
        "Yaygın Node.js risk kalıpları için statik lint kuralları.",
      ),
      loc(
        "An ESLint plugin flagging common Node.js security anti-patterns (e.g. unsafe regex, eval usage) during linting.",
        "Lint sırasında yaygın Node.js güvenlik anti-desenlerini (ör. güvensiz regex, eval kullanımı) işaretleyen bir ESLint eklentisi.",
      ),
      ["domain-backend-api", "domain-web"],
      ["static-analysis", "lint"],
    ),
    kind: "security-tool",
    difficulty: "beginner",
    recommendation: rec({
      requirementTags: ["security-review"],
      baseScore: 45,
      setupEffort: "low",
    }),
    details: { packageName: "eslint-plugin-security", runtimeRequirements: ["eslint"] },
  },
  {
    ...base(
      "security-tool-dependabot",
      "Dependabot",
      loc(
        "Automated dependency vulnerability alerts/PRs.",
        "Otomatik bağımlılık zafiyet uyarıları/PR'ları.",
      ),
      loc(
        "A GitHub-native tool that opens automated pull requests for vulnerable/outdated dependencies.",
        "Zafiyetli/güncel olmayan bağımlılıklar için otomatik pull request açan, GitHub'a yerleşik bir araç.",
      ),
      ["domain-cloud-devops"],
      ["dependency-scanning"],
    ),
    kind: "security-tool",
    difficulty: "beginner",
    recommendation: rec({
      requirementTags: ["dependency-scanning"],
      baseScore: 50,
      setupEffort: "low",
    }),
    details: { runtimeRequirements: ["github"] },
  },
  {
    ...base(
      "security-tool-owasp-zap",
      "OWASP ZAP",
      loc("Web application security scanner.", "Web uygulaması güvenlik tarayıcısı."),
      loc(
        "An open-source dynamic application security testing (DAST) tool for finding vulnerabilities in running web apps.",
        "Çalışan web uygulamalarındaki zafiyetleri bulmak için açık kaynak bir dinamik uygulama güvenlik testi (DAST) aracı.",
      ),
      ["domain-cybersecurity", "domain-web"],
      ["dast", "scanning"],
    ),
    kind: "security-tool",
    difficulty: "advanced",
    recommendation: rec({
      supportedProfiles: ["advanced", "team"],
      requirementTags: ["security-review"],
      baseScore: 35,
      setupEffort: "high",
    }),
    details: { runtimeRequirements: [] },
  },
];

// ---------------------------------------------------------------------------
// deployment
// ---------------------------------------------------------------------------

const deploymentItems: CatalogItemBase<"deployment", IntegrationDetails>[] = [
  {
    ...base(
      "deployment-netlify",
      "Netlify",
      loc(
        "Static hosting with serverless functions.",
        "Serverless fonksiyonlarla statik barındırma.",
      ),
      loc(
        "A static site host with integrated serverless functions and deploy previews.",
        "Entegre serverless fonksiyonlar ve önizleme dağıtımları sunan bir statik site barındırıcısı.",
      ),
      ["domain-web", "domain-cloud-devops"],
      ["static-hosting", "serverless"],
    ),
    kind: "deployment",
    difficulty: "beginner",
    recommendation: rec({ preferredDomainIds: ["domain-web"], baseScore: 55, setupEffort: "low" }),
    details: {
      integrationType: "deployment",
      secretRequired: false,
      defaultEnabled: false,
      reviewChecklistIds: [],
    },
  },
  {
    ...base(
      "deployment-vercel",
      "Vercel",
      loc(
        "Frontend-focused hosting with edge functions.",
        "Edge fonksiyonlarıyla frontend odaklı barındırma.",
      ),
      loc(
        "A hosting platform optimized for frontend frameworks with edge/serverless functions and preview deploys.",
        "Frontend çatıları için optimize edilmiş, edge/serverless fonksiyonlar ve önizleme dağıtımları sunan bir barındırma platformu.",
      ),
      ["domain-web"],
      ["static-hosting", "edge"],
    ),
    kind: "deployment",
    difficulty: "beginner",
    recommendation: rec({ preferredDomainIds: ["domain-web"], baseScore: 50, setupEffort: "low" }),
    details: {
      integrationType: "deployment",
      secretRequired: false,
      defaultEnabled: false,
      reviewChecklistIds: [],
    },
  },
  {
    ...base(
      "deployment-docker",
      "Docker",
      loc("Container packaging and runtime.", "Konteyner paketleme ve çalışma zamanı."),
      loc(
        "Packages an application and its dependencies into a portable container image.",
        "Bir uygulamayı ve bağımlılıklarını taşınabilir bir konteyner imajına paketler.",
      ),
      ["domain-cloud-devops", "domain-backend-api"],
      ["containers"],
    ),
    kind: "deployment",
    difficulty: "intermediate",
    recommendation: rec({
      preferredDomainIds: ["domain-cloud-devops"],
      baseScore: 45,
      setupEffort: "medium",
    }),
    details: {
      integrationType: "deployment",
      secretRequired: false,
      defaultEnabled: false,
      reviewChecklistIds: [],
    },
  },
];

// ---------------------------------------------------------------------------
// cloud-service
// ---------------------------------------------------------------------------

const cloudServiceItems: CatalogItemBase<"cloud-service", IntegrationDetails>[] = [
  {
    ...base(
      "cloud-service-aws",
      "Amazon Web Services",
      loc("Broad general-purpose cloud provider.", "Geniş kapsamlı genel amaçlı bulut sağlayıcı."),
      loc(
        "A broad cloud provider offering compute, storage, database, and managed services.",
        "Hesaplama, depolama, veritabanı ve yönetilen servisler sunan geniş kapsamlı bir bulut sağlayıcı.",
      ),
      ["domain-cloud-devops"],
      ["iaas", "paas"],
    ),
    kind: "cloud-service",
    difficulty: "advanced",
    recommendation: rec({
      supportedScales: ["standard", "enterprise"],
      baseScore: 45,
      setupEffort: "high",
    }),
    details: {
      integrationType: "cloud",
      secretRequired: true,
      defaultEnabled: false,
      reviewChecklistIds: [],
    },
  },
  {
    ...base(
      "cloud-service-google-cloud",
      "Google Cloud Platform",
      loc("General-purpose cloud provider.", "Genel amaçlı bulut sağlayıcı."),
      loc(
        "A cloud provider offering compute, storage, database, and managed AI/data services.",
        "Hesaplama, depolama, veritabanı ve yönetilen AI/veri servisleri sunan bir bulut sağlayıcı.",
      ),
      ["domain-cloud-devops", "domain-ai-ml"],
      ["iaas", "paas"],
    ),
    kind: "cloud-service",
    difficulty: "advanced",
    recommendation: rec({
      supportedScales: ["standard", "enterprise"],
      baseScore: 40,
      setupEffort: "high",
    }),
    details: {
      integrationType: "cloud",
      secretRequired: true,
      defaultEnabled: false,
      reviewChecklistIds: [],
    },
  },
  {
    ...base(
      "cloud-service-azure",
      "Microsoft Azure",
      loc("General-purpose cloud provider.", "Genel amaçlı bulut sağlayıcı."),
      loc(
        "A cloud provider offering compute, storage, database, and managed services with strong enterprise/Microsoft-stack integration.",
        "Kurumsal/Microsoft yığınıyla güçlü entegrasyon sunan; hesaplama, depolama, veritabanı ve yönetilen servisler sağlayan bir bulut sağlayıcı.",
      ),
      ["domain-cloud-devops"],
      ["iaas", "paas"],
    ),
    kind: "cloud-service",
    difficulty: "advanced",
    recommendation: rec({
      supportedScales: ["standard", "enterprise"],
      baseScore: 40,
      setupEffort: "high",
    }),
    details: {
      integrationType: "cloud",
      secretRequired: true,
      defaultEnabled: false,
      reviewChecklistIds: [],
    },
  },
];

// ---------------------------------------------------------------------------
// agent
// ---------------------------------------------------------------------------

const agentItems: CatalogItemBase<"agent", AgentDetails>[] = [
  {
    ...base(
      "agent-frontend-engineer",
      "Frontend Engineer Agent",
      loc("Owns UI/component implementation.", "Arayüz/bileşen uygulamasını yönetir."),
      loc(
        "An agent role scoped to implementing pages/components/UI state per approved design and contracts.",
        "Onaylanmış tasarım ve sözleşmelere göre sayfa/bileşen/arayüz durumu uygulamaktan sorumlu bir ajan rolü.",
      ),
      [],
      ["ui", "implementation"],
    ),
    kind: "agent",
    difficulty: "intermediate",
    recommendation: rec({
      supportedProfiles: ["advanced", "team"],
      baseScore: 40,
      setupEffort: "medium",
    }),
    details: {
      role: loc("Frontend implementation owner", "Frontend uygulama sorumlusu"),
      responsibilities: [
        loc(
          "Implement pages/components per approved contracts.",
          "Onaylanmış sözleşmelere göre sayfa/bileşen uygular.",
        ),
      ],
      allowedToolCategories: ["file-edit", "test-run"],
      forbiddenActions: ["deploy", "modify-secrets"],
      outputContract: ["diff", "test-evidence"],
      contentTemplateId: "agent-template-frontend-engineer",
    },
  },
  {
    ...base(
      "agent-qa-reviewer",
      "QA Reviewer Agent",
      loc(
        "Independently verifies test coverage/results.",
        "Test kapsamını/sonuçlarını bağımsız doğrular.",
      ),
      loc(
        "An agent role that reviews test coverage and evidence independently of the implementer.",
        "Uygulayıcıdan bağımsız olarak test kapsamını ve kanıtlarını inceleyen bir ajan rolü.",
      ),
      [],
      ["quality", "review"],
    ),
    kind: "agent",
    difficulty: "intermediate",
    recommendation: rec({ supportedProfiles: ["team"], baseScore: 35, setupEffort: "medium" }),
    details: {
      role: loc("Independent QA reviewer", "Bağımsız QA denetçisi"),
      responsibilities: [
        loc(
          "Verify acceptance criteria against actual test evidence.",
          "Kabul kriterlerini gerçek test kanıtlarına göre doğrular.",
        ),
      ],
      allowedToolCategories: ["test-run", "read"],
      forbiddenActions: ["merge-without-evidence"],
      outputContract: ["test-evidence"],
      contentTemplateId: "agent-template-qa-reviewer",
    },
  },
  {
    ...base(
      "agent-security-reviewer",
      "Security Reviewer Agent",
      loc(
        "Independently reviews security-relevant changes.",
        "Güvenlikle ilgili değişiklikleri bağımsız inceler.",
      ),
      loc(
        "An agent role that reviews security-sensitive changes (auth, secrets, external calls) independently of the implementer.",
        "Güvenlik açısından hassas değişiklikleri (kimlik doğrulama, gizli anahtarlar, dış çağrılar) uygulayıcıdan bağımsız inceleyen bir ajan rolü.",
      ),
      [],
      ["security", "review"],
    ),
    kind: "agent",
    difficulty: "advanced",
    recommendation: rec({
      supportedProfiles: ["team"],
      requirementTags: ["security-review"],
      baseScore: 35,
      setupEffort: "medium",
    }),
    details: {
      role: loc("Independent security reviewer", "Bağımsız güvenlik denetçisi"),
      responsibilities: [
        loc(
          "Review auth/secret/external-call changes for risk.",
          "Kimlik doğrulama/gizli anahtar/dış çağrı değişikliklerini risk açısından inceler.",
        ),
      ],
      allowedToolCategories: ["read", "test-run"],
      forbiddenActions: ["deploy", "modify-secrets"],
      outputContract: ["security-findings"],
      contentTemplateId: "agent-template-security-reviewer",
    },
  },
];

// ---------------------------------------------------------------------------
// skill
// ---------------------------------------------------------------------------

const skillItems: CatalogItemBase<"skill", SkillDetails>[] = [
  {
    ...base(
      "skill-code-review",
      "Code Review Skill",
      loc(
        "Structured review checklist/output.",
        "Yapılandırılmış inceleme kontrol listesi/çıktısı.",
      ),
      loc(
        "A reusable skill guiding a structured code review pass with a consistent findings format.",
        "Tutarlı bir bulgu biçimiyle yapılandırılmış bir kod incelemesi geçişine rehberlik eden yeniden kullanılabilir bir yetenek.",
      ),
      [],
      ["review", "quality"],
    ),
    kind: "skill",
    difficulty: "beginner",
    recommendation: rec({ baseScore: 40, setupEffort: "low" }),
    details: {
      invocationMode: "manual",
      contentTemplateId: "skill-template-code-review",
      supportingFileIds: [],
      estimatedContextSize: "small",
    },
  },
  {
    ...base(
      "skill-test-generation",
      "Test Generation Skill",
      loc(
        "Drafts unit/component tests for new code.",
        "Yeni kod için birim/bileşen testleri taslağı hazırlar.",
      ),
      loc(
        "A reusable skill for drafting unit/component tests covering happy path, boundary, and error cases.",
        "Mutlu yol, sınır ve hata durumlarını kapsayan birim/bileşen testleri taslağı hazırlayan yeniden kullanılabilir bir yetenek.",
      ),
      [],
      ["testing"],
    ),
    kind: "skill",
    difficulty: "intermediate",
    recommendation: rec({ baseScore: 45, setupEffort: "low" }),
    details: {
      invocationMode: "manual",
      contentTemplateId: "skill-template-test-generation",
      supportingFileIds: [],
      estimatedContextSize: "medium",
    },
  },
  {
    ...base(
      "skill-documentation-writer",
      "Documentation Writer Skill",
      loc("Drafts README/API docs from code.", "Koddan README/API dokümanları taslağı hazırlar."),
      loc(
        "A reusable skill for drafting user-facing documentation (README, API reference) from existing code/contracts.",
        "Mevcut koddan/sözleşmelerden kullanıcıya yönelik dokümantasyon (README, API referansı) taslağı hazırlayan yeniden kullanılabilir bir yetenek.",
      ),
      [],
      ["documentation"],
    ),
    kind: "skill",
    difficulty: "beginner",
    recommendation: rec({ baseScore: 30, setupEffort: "low" }),
    details: {
      invocationMode: "manual",
      contentTemplateId: "skill-template-documentation-writer",
      supportingFileIds: [],
      estimatedContextSize: "small",
    },
  },
];

// ---------------------------------------------------------------------------
// document-template
// ---------------------------------------------------------------------------

const documentTemplateItems: CatalogItemBase<"document-template", DocumentTemplateDetails>[] = [
  {
    ...base(
      "document-template-readme",
      "README Template",
      loc("Project overview/setup document.", "Proje özeti/kurulum dokümanı."),
      loc(
        "A standard README structure covering purpose, setup, usage, and contribution notes.",
        "Amaç, kurulum, kullanım ve katkı notlarını kapsayan standart bir README yapısı.",
      ),
      [],
      ["documentation"],
    ),
    kind: "document-template",
    difficulty: "beginner",
    recommendation: rec({ baseScore: 50, setupEffort: "low" }),
    details: {
      outputPathTemplate: "README.md",
      templateId: "document-template-readme",
      requiredVariables: ["projectName", "projectSummary"],
      generatedLanguageSupport: ["en", "tr"],
      optional: false,
    },
  },
  {
    ...base(
      "document-template-api-contract",
      "API Contract Template",
      loc("Endpoint/schema reference document.", "Uç nokta/şema referans dokümanı."),
      loc(
        "A template for documenting API endpoints, request/response schemas, and error envelopes.",
        "API uç noktalarını, istek/yanıt şemalarını ve hata zarflarını belgeleyen bir şablon.",
      ),
      ["domain-backend-api"],
      ["api", "documentation"],
    ),
    kind: "document-template",
    difficulty: "intermediate",
    recommendation: rec({
      preferredDomainIds: ["domain-backend-api"],
      baseScore: 35,
      setupEffort: "low",
    }),
    details: {
      outputPathTemplate: "docs/API_CONTRACT.md",
      templateId: "document-template-api-contract",
      requiredVariables: ["endpoints"],
      generatedLanguageSupport: ["en"],
      optional: true,
    },
  },
  {
    ...base(
      "document-template-decision-log",
      "Decision Log Template",
      loc("Running record of key decisions.", "Önemli kararların sürekli kaydı."),
      loc(
        "A template for recording key decisions with rationale, owner, and date over a project's life.",
        "Bir projenin ömrü boyunca önemli kararları gerekçe, sorumlu ve tarih ile kaydeden bir şablon.",
      ),
      [],
      ["governance"],
    ),
    kind: "document-template",
    difficulty: "beginner",
    recommendation: rec({ baseScore: 25, setupEffort: "low" }),
    details: {
      outputPathTemplate: "docs/DECISION_LOG.md",
      templateId: "document-template-decision-log",
      requiredVariables: [],
      generatedLanguageSupport: ["en", "tr"],
      optional: true,
    },
  },
];

// ---------------------------------------------------------------------------
// mcp
// ---------------------------------------------------------------------------

const mcpItems: CatalogItemBase<"mcp", IntegrationDetails>[] = [
  {
    ...base(
      "mcp-filesystem",
      "Filesystem MCP Server",
      loc("Scoped local filesystem access.", "Kapsamlı yerel dosya sistemi erişimi."),
      loc(
        "An MCP server exposing scoped read/write access to a local directory.",
        "Yerel bir dizine kapsamlı okuma/yazma erişimi sunan bir MCP sunucusu.",
      ),
      [],
      ["filesystem"],
    ),
    kind: "mcp",
    difficulty: "intermediate",
    recommendation: rec({
      supportedProfiles: ["advanced", "team"],
      baseScore: 30,
      setupEffort: "medium",
    }),
    details: {
      integrationType: "mcp",
      secretRequired: false,
      defaultEnabled: false,
      reviewChecklistIds: [],
    },
  },
  {
    ...base(
      "mcp-git",
      "Git MCP Server",
      loc("Repository history/diff access.", "Depo geçmişi/diff erişimi."),
      loc(
        "An MCP server exposing local git repository history, diffs, and branch operations.",
        "Yerel git deposu geçmişi, diff ve dal işlemlerini sunan bir MCP sunucusu.",
      ),
      [],
      ["git"],
    ),
    kind: "mcp",
    difficulty: "intermediate",
    recommendation: rec({
      supportedProfiles: ["advanced", "team"],
      baseScore: 30,
      setupEffort: "medium",
    }),
    details: {
      integrationType: "mcp",
      secretRequired: false,
      defaultEnabled: false,
      reviewChecklistIds: [],
    },
  },
  {
    ...base(
      "mcp-fetch",
      "Fetch MCP Server",
      loc("Bounded outbound HTTP fetch.", "Sınırlı dışa yönelik HTTP isteği."),
      loc(
        "An MCP server exposing a bounded outbound HTTP fetch capability.",
        "Sınırlı, dışa yönelik bir HTTP isteği yeteneği sunan bir MCP sunucusu.",
      ),
      [],
      ["network"],
    ),
    kind: "mcp",
    difficulty: "advanced",
    recommendation: rec({
      supportedProfiles: ["advanced", "team"],
      baseScore: 20,
      setupEffort: "medium",
      avoidWhen: [
        loc(
          "Outbound network access is not required or not approved.",
          "Dışa yönelik ağ erişimi gerekli veya onaylı değilse.",
        ),
      ],
    }),
    details: {
      integrationType: "mcp",
      secretRequired: false,
      defaultEnabled: false,
      reviewChecklistIds: [],
    },
  },
];

// ---------------------------------------------------------------------------
// hook
// ---------------------------------------------------------------------------

const hookItems: CatalogItemBase<"hook", IntegrationDetails>[] = [
  {
    ...base(
      "hook-pre-commit-lint",
      "Pre-Commit Lint Hook",
      loc("Blocks a commit on lint/format failure.", "Lint/biçim hatasında commit'i engeller."),
      loc(
        "Runs lint/format checks before a commit is created and blocks it on failure.",
        "Bir commit oluşturulmadan önce lint/biçim denetimlerini çalıştırır ve hata durumunda engeller.",
      ),
      [],
      ["quality-gate", "git"],
    ),
    kind: "hook",
    difficulty: "beginner",
    recommendation: rec({ requirementTags: ["quality-gate"], baseScore: 45, setupEffort: "low" }),
    details: {
      integrationType: "hook",
      secretRequired: false,
      defaultEnabled: false,
      reviewChecklistIds: [],
    },
  },
  {
    ...base(
      "hook-pre-tool-use-guard",
      "Pre-Tool-Use Guard Hook",
      loc(
        "Blocks a disallowed tool action before execution.",
        "İzin verilmeyen araç eylemini yürütmeden önce engeller.",
      ),
      loc(
        "Runs before a tool action executes and blocks actions outside an allowed set (e.g. destructive commands).",
        "Bir araç eylemi yürütülmeden önce çalışır ve izin verilen kümenin dışındaki eylemleri (ör. yıkıcı komutlar) engeller.",
      ),
      [],
      ["safety"],
    ),
    kind: "hook",
    difficulty: "intermediate",
    recommendation: rec({
      supportedProfiles: ["advanced", "team"],
      baseScore: 40,
      setupEffort: "medium",
    }),
    details: {
      integrationType: "hook",
      secretRequired: false,
      defaultEnabled: false,
      reviewChecklistIds: [],
    },
  },
  {
    ...base(
      "hook-ci-status-notify",
      "CI Status Notify Hook",
      loc("Notifies on CI pipeline status change.", "CI hattı durum değişikliğinde bildirir."),
      loc(
        "Notifies a configured channel when a CI pipeline run's status changes (success/failure).",
        "Bir CI hattı çalışmasının durumu (başarılı/başarısız) değiştiğinde yapılandırılmış bir kanalı bilgilendirir.",
      ),
      ["domain-cloud-devops"],
      ["ci-cd", "notification"],
    ),
    kind: "hook",
    difficulty: "beginner",
    relations: [
      relation(
        "replaces",
        "hook-post-commit-notify",
        loc(
          "Reports actual pipeline outcome instead of the commit event alone.",
          "Yalnızca commit olayı yerine gerçek hat sonucunu bildirir.",
        ),
      ),
    ],
    recommendation: rec({
      preferredDomainIds: ["domain-cloud-devops"],
      baseScore: 30,
      setupEffort: "low",
    }),
    details: {
      integrationType: "hook",
      secretRequired: false,
      defaultEnabled: false,
      reviewChecklistIds: [],
    },
  },
  {
    ...base(
      "hook-post-commit-notify",
      "Post-Commit Notify Hook (legacy)",
      loc("Notifies on every local commit.", "Her yerel commit'te bildirir."),
      loc(
        "Notifies a configured channel on every local commit, regardless of whether CI later passes or fails. Superseded by CI Status Notify, which reports the actual pipeline outcome.",
        "CI'nin daha sonra başarılı ya da başarısız olmasından bağımsız olarak her yerel commit'te yapılandırılmış bir kanalı bilgilendirir. Gerçek hat sonucunu bildiren CI Status Notify ile yer değiştirmiştir.",
      ),
      ["domain-cloud-devops"],
      ["git", "notification"],
    ),
    kind: "hook",
    difficulty: "beginner",
    maturity: "deprecated",
    recommendation: rec({
      baseScore: 10,
      setupEffort: "low",
      avoidWhen: [
        loc(
          "Use CI Status Notify instead — this notifies before CI has actually run.",
          "Bunun yerine CI Status Notify kullanın — bu, CI henüz çalışmadan bildirim gönderir.",
        ),
      ],
    }),
    details: {
      integrationType: "hook",
      secretRequired: false,
      defaultEnabled: false,
      reviewChecklistIds: [],
    },
  },
];

// ---------------------------------------------------------------------------
// quality-gate
// ---------------------------------------------------------------------------

const qualityGateItems: CatalogItemBase<"quality-gate", QualityGateDetails>[] = [
  {
    ...base(
      "quality-gate-lint",
      "Lint Gate",
      loc("Static style/error checks must pass.", "Statik biçim/hata denetimleri geçmelidir."),
      loc(
        "Requires the project's linter to run clean before the change is considered complete.",
        "Değişikliğin tamamlanmış sayılabilmesi için projenin lint aracının hatasız çalışmasını gerektirir.",
      ),
      [],
      ["lint"],
    ),
    kind: "quality-gate",
    difficulty: "beginner",
    recommendation: rec({ requirementTags: ["quality-gate"], baseScore: 55, setupEffort: "low" }),
    details: { commandCapability: "lint", blocksRelease: true, evidenceType: "command-output" },
  },
  {
    ...base(
      "quality-gate-typecheck",
      "Typecheck Gate",
      loc("Static type checks must pass.", "Statik tip denetimleri geçmelidir."),
      loc(
        "Requires the project's type checker to run clean before the change is considered complete.",
        "Değişikliğin tamamlanmış sayılabilmesi için projenin tip denetleyicisinin hatasız çalışmasını gerektirir.",
      ),
      [],
      ["typecheck"],
    ),
    kind: "quality-gate",
    difficulty: "beginner",
    relations: [
      relation(
        "requires",
        "language-typescript",
        loc(
          "A typecheck gate needs a statically typed language to check.",
          "Tip denetimi kapısının denetleyecek statik tipli bir dile ihtiyacı vardır.",
        ),
        "warning",
      ),
    ],
    recommendation: rec({
      requirementTags: ["quality-gate", "type-safety"],
      baseScore: 50,
      setupEffort: "low",
    }),
    details: {
      commandCapability: "typecheck",
      blocksRelease: true,
      evidenceType: "command-output",
    },
  },
  {
    ...base(
      "quality-gate-unit-test-coverage",
      "Unit Test Coverage Gate",
      loc(
        "Unit tests must pass at an agreed coverage bar.",
        "Birim testleri kararlaştırılan kapsam eşiğinde geçmelidir.",
      ),
      loc(
        "Requires the unit/component test suite to pass and meet an agreed coverage bar before release.",
        "Sürüm öncesinde birim/bileşen test paketinin geçmesini ve kararlaştırılan kapsam eşiğini karşılamasını gerektirir.",
      ),
      [],
      ["testing"],
    ),
    kind: "quality-gate",
    difficulty: "intermediate",
    recommendation: rec({
      requirementTags: ["quality-gate"],
      baseScore: 45,
      setupEffort: "medium",
    }),
    details: {
      commandCapability: "unit_test",
      blocksRelease: true,
      evidenceType: "command-output",
    },
  },
];

export const SYSTEM_CATALOG_VERSION = "1.0.0";

export const SYSTEM_CATALOG_ITEMS: CatalogItem[] = [
  ...domainItems,
  ...subdomainItems,
  ...languageItems,
  ...frameworkItems,
  ...libraryItems,
  ...uiSystemItems,
  ...databaseItems,
  ...architectureItems,
  ...stateManagementItems,
  ...testingToolItems,
  ...securityToolItems,
  ...deploymentItems,
  ...cloudServiceItems,
  ...agentItems,
  ...skillItems,
  ...documentTemplateItems,
  ...mcpItems,
  ...hookItems,
  ...qualityGateItems,
];
