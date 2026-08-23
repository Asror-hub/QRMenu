import { useEffect } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { getContactConfig } from "../contact.js";
import { getPublicSiteUrl, upsertCanonical, upsertJsonLd, upsertMeta } from "../seo.js";

const FAQ_IDS = ["1", "2", "3", "4", "5"];
const OG_LOCALES = { en: "en_US", ru: "ru_RU", uz: "uz_UZ" };

export function Seo() {
  const { lang, t } = useLanguage();

  useEffect(() => {
    const site = getPublicSiteUrl();
    const title = t("seo.title");
    const description = t("seo.description");
    const image = site ? `${site}/og.svg` : "/og.svg";
    const contact = getContactConfig();

    document.title = title;
    document.documentElement.lang = lang;

    upsertMeta("name", "description", description);
    upsertMeta("name", "robots", "index, follow");
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:locale", OG_LOCALES[lang] || "en_US");
    upsertMeta("property", "og:image", image);
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", image);

    if (site) {
      upsertCanonical(`${site}/`);
      upsertMeta("property", "og:url", `${site}/`);
    }

    upsertJsonLd("qrmenu-org", {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "QRMenu",
      url: site || undefined,
      email: contact.email,
      telephone: contact.phone,
      description,
      logo: site ? `${site}/favicon.svg` : undefined,
    });

    upsertJsonLd("qrmenu-app", {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "QRMenu",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, iOS, Android",
      description,
      url: site || undefined,
      offers: {
        "@type": "AggregateOffer",
        lowPrice: "99000",
        highPrice: "249000",
        priceCurrency: "UZS",
      },
    });

    upsertJsonLd("qrmenu-faq", {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ_IDS.map((id) => ({
        "@type": "Question",
        name: t(`faq.q${id}`),
        acceptedAnswer: {
          "@type": "Answer",
          text: t(`faq.a${id}`),
        },
      })),
    });
  }, [lang, t]);

  return null;
}
