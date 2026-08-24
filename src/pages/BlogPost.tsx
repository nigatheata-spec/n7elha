import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Seo } from "@/components/Seo";

type Post = {
  slug: string;
  title_ar: string;
  title_en: string;
  excerpt_ar: string;
  excerpt_en: string;
  body_ar: string;
  body_en: string;
  published_at: string;
};

const BlogPost = () => {
  const { slug } = useParams();
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [post, setPost] = useState<Post | null | undefined>(undefined);

  useEffect(() => {
    if (!slug) return;
    supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data }) => setPost((data as Post) ?? null));
  }, [slug]);

  const backLabel = isAr ? "الرجوع إلى المدونة" : "Back to blog";

  if (post === undefined) {
    return (
      <div className="min-h-screen w-full" style={{ background: "hsl(var(--cream-panel))" }}>
        <SiteNav />
      </div>
    );
  }

  if (post === null) {
    return (
      <div className="min-h-screen w-full" style={{ background: "hsl(var(--cream-panel))", fontFamily: "'Outfit', 'Almarai', system-ui, sans-serif" }}>
        <Seo
          path={`/blog/${slug}`}
          titleAr="المقال غير موجود"
          titleEn="Article Not Found"
          descriptionAr="لم نعثر على هذا المقال."
          descriptionEn="This article could not be found."
          index={false}
        />
        <SiteNav />
        <section className="wrap px-5 sm:px-8 md:px-14 py-24 text-center">
          <Link to="/blog" className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#3F5A63]">
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
        </section>
        <SiteFooter />
      </div>
    );
  }

  const title = isAr ? post.title_ar : post.title_en;
  const excerpt = isAr ? post.excerpt_ar : post.excerpt_en;
  const body = isAr ? post.body_ar : post.body_en;

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: "hsl(var(--cream-panel))", fontFamily: "'Outfit', 'Almarai', system-ui, sans-serif" }}
    >
      <Seo path={`/blog/${post.slug}`} titleAr={post.title_ar} titleEn={post.title_en} descriptionAr={post.excerpt_ar} descriptionEn={excerpt} />
      <SiteNav />

      <div className="wrap px-5 sm:px-8 md:px-14 pt-10 sm:pt-16 pb-20 sm:pb-28 max-w-2xl">
        <Link to="/blog" className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#3F5A63]/70 hover:text-[#3F5A63]">
          <ArrowLeft className="h-3.5 w-3.5" />
          {backLabel}
        </Link>

        {/* Everything else sits inside one bounded card, matching the site's
            neobrutalist surfaces elsewhere — a long article floating directly
            on the cream background with nothing to anchor it read as unfinished. */}
        <article className="mt-6 rounded-2xl border-2 border-[hsl(var(--nb-border))] bg-white p-6 sm:p-10 shadow-[6px_6px_0_0_hsl(var(--nb-border))]">
          <span className="block text-[13px] text-black/40">
            {new Date(post.published_at).toLocaleDateString(isAr ? "ar" : "en-US", { year: "numeric", month: "long", day: "2-digit", calendar: "gregory" })}
          </span>
          <h1
            className="mt-2 leading-[1.15] tracking-tight text-[28px] sm:text-[38px]"
            style={{ fontFamily: "'ArslanWessam', 'Almarai', sans-serif", color: "#3F5A63" }}
          >
            {title}
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-black/60">{excerpt}</p>

          <div className="mt-10 prose prose-neutral max-w-none text-[15px] leading-relaxed text-black/80 prose-headings:text-[#3F5A63] prose-a:text-[#3F5A63]">
            <ReactMarkdown>{body}</ReactMarkdown>
          </div>
        </article>
      </div>

      <SiteFooter />
    </div>
  );
};

export default BlogPost;
