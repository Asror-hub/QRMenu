import { Reveal } from "./Reveal.jsx";
import { BrandMark, BrandWordmark } from "./BrandMark.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

const year = new Date().getFullYear();

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="site-footer">
      <Reveal className="footer__inner">
        <div className="footer__brand">
          <a className="brand" href="#top">
            <BrandMark />
            <BrandWordmark />
          </a>
          <p>{t("footer.blurb")}</p>
        </div>
        <div className="footer__col">
          <h3>{t("footer.product")}</h3>
          <ul>
            <li>
              <a href="#demo">{t("nav.demo")}</a>
            </li>
            <li>
              <a href="#product">{t("nav.products")}</a>
            </li>
            <li>
              <a href="#platform">{t("nav.platform")}</a>
            </li>
            <li>
              <a href="#pricing">{t("nav.pricing")}</a>
            </li>
            <li>
              <a href="#faq">{t("nav.faq")}</a>
            </li>
          </ul>
        </div>
        <div className="footer__col">
          <h3>{t("footer.contact")}</h3>
          <ul>
            <li>
              <a href="#contact">{t("footer.messageUs")}</a>
            </li>
            <li>
              <a href="#pricing">{t("footer.choosePackage")}</a>
            </li>
          </ul>
        </div>
        <div className="footer__col">
          <h3>{t("footer.company")}</h3>
          <ul>
            <li>
              <a href="#top">{t("footer.about")}</a>
            </li>
            <li>
              <a href="#ecosystem">{t("footer.whoFor")}</a>
            </li>
            <li>
              <a href="/privacy.html">{t("footer.privacy")}</a>
            </li>
          </ul>
        </div>
      </Reveal>
      <Reveal as="p" className="footer__bottom" delay={140}>
        © {year} SmartQr. {t("footer.rights")}
      </Reveal>
    </footer>
  );
}
