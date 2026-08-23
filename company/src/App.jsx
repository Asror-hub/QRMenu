import "./Landing.css";
import { Header } from "./components/Header.jsx";
import { Hero } from "./components/Hero.jsx";
import { VideoStage } from "./components/VideoStage.jsx";
import { ProductsShowcase } from "./components/ProductsShowcase.jsx";
import { Ecosystem } from "./components/Ecosystem.jsx";
import { Platform } from "./components/Platform.jsx";
import { Pricing } from "./components/Pricing.jsx";
import { FAQ } from "./components/FAQ.jsx";
import { Contact } from "./components/Contact.jsx";
import { Footer } from "./components/Footer.jsx";
import { Seo } from "./components/Seo.jsx";
import { useLanguage } from "./context/LanguageContext.jsx";

export default function App() {
  const { t } = useLanguage();

  return (
    <>
      <Seo />
      <a className="skip-link" href="#main">
        {t("seo.skip")}
      </a>
      <Header />
      <main id="main">
        <Hero />
        <VideoStage />
        <ProductsShowcase />
        <Ecosystem />
        <Platform />
        <Pricing />
        <FAQ />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
