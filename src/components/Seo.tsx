import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";

const SITE_URL = "https://www.nefelha.com";
const SITE_NAME_AR = "نفلها";
const SITE_NAME_EN = "nfelha";

type SeoProps = {
  /** Page-specific title, without the site name — Seo appends " | نفلها" / " | nfelha". */
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  /** Path only, e.g. "/about" — root is "/". */
  path: string;
  /** Set false on auth walls, dynamic per-session views, and error pages so they never get indexed. */
  index?: boolean;
  /** Raw JSON-LD object(s), homepage-only in practice — gives AI Overviews,
   *  ChatGPT, and Perplexity a structured entity to cite instead of having to
   *  infer who nfelha is from prose. */
  jsonLd?: object | object[];
};

/**
 * Per-route head tags. The app has no SSR, so index.html's static tags are only
 * what crawlers see before JS runs — every route was previously shipping the
 * homepage's title, description, and (critically) a canonical hardcoded to "/",
 * which told Google every page WAS the homepage. This overwrites all of that
 * once React mounts, and sets a real self-referencing canonical per route.
 */
export const Seo = ({ titleAr, titleEn, descriptionAr, descriptionEn, path, index = true, jsonLd }: SeoProps) => {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const title = isAr ? `${titleAr} | ${SITE_NAME_AR}` : `${titleEn} | ${SITE_NAME_EN}`;
  const description = isAr ? descriptionAr : descriptionEn;
  const url = path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}`;
  const schemas = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta name="robots" content={index ? "index, follow" : "noindex, nofollow"} />
      <meta property="og:title" content={isAr ? titleAr : titleEn} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:locale" content={isAr ? "ar_SA" : "en_US"} />
      {schemas.map((schema, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(schema)}</script>
      ))}
    </Helmet>
  );
};
