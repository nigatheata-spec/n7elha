import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowUpRight } from "lucide-react";
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
  published_at: string;
};

const Blog = () => {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("blog_posts")
      .select("slug, title_ar, title_en, excerpt_ar, excerpt_en, published_at")
      .order("published_at", { ascending: false })
      .then(({ data }) => {
        setPosts((data as Post[]) ?? []);
        setLoading(false);
      });
  }, []);

  const t = isAr
    ? { kicker: "المدونة", title: "أفكار عن التعلم التفاعلي", sub: "مقالات عن تفاعل الطلاب، التعلم باللعب، والتعليم الرقمي في السعودية.", empty: "لا توجد مقالات بعد.", readMore: "اقرأ المقال" }
    : { kicker: "BLOG", title: "Ideas on interactive learning", sub: "Articles on student engagement, gamified learning, and digital education in Saudi Arabia.", empty: "No posts yet.", readMore: "Read the article" };

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: "hsl(var(--cream-panel))", fontFamily: "'Outfit', 'Almarai', system-ui, sans-serif" }}
    >
      <Seo
        path="/blog"
        titleAr="المدونة — تفاعل الطلاب والتعلم باللعب"
        titleEn="Blog — Student Engagement & Gamified Learning"
        descriptionAr="مقالات عن أدوات تفاعل الطلاب، التعلم باللعب، الذكاء الاصطناعي في التعليم، وواقع التعليم التفاعلي في السعودية."
        descriptionEn="Articles on classroom engagement tools, gamified learning, AI in education, and the state of interactive learning in Saudi Arabia."
      />
      <SiteNav />

      <section className="wrap relative overflow-hidden px-5 sm:px-8 md:px-14 pt-10 sm:pt-16 pb-14 sm:pb-20">
        <span className={`text-[12px] font-semibold text-[#3F5A63] ${isAr ? "tracking-normal" : "tracking-[0.25em]"}`}>{t.kicker}</span>
        <h1
          className="mt-3 max-w-2xl leading-[1.1] tracking-tight text-[32px] sm:text-[46px]"
          style={{ fontFamily: "'ArslanWessam', 'Almarai', sans-serif", color: "#3F5A63" }}
        >
          {t.title}
        </h1>
        <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-black/65">{t.sub}</p>
      </section>

      <section className="wrap px-5 sm:px-8 md:px-14 pb-20 sm:pb-28">
        {loading ? (
          <div className="text-black/50 text-sm">...</div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border-2 border-[hsl(var(--nb-border))] bg-white p-10 text-center text-black/50 shadow-[4px_4px_0_0_hsl(var(--nb-border))]">
            {t.empty}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {posts.map((p, i) => (
              <Link
                key={p.slug}
                to={`/blog/${p.slug}`}
                className={`group ${i % 2 === 0 ? "-rotate-[0.4deg]" : "rotate-[0.5deg]"} hover:rotate-0 transition-transform duration-300`}
              >
                <div className="relative h-full rounded-2xl border-2 border-[hsl(var(--nb-border))] bg-white p-6 shadow-[5px_5px_0_0_hsl(var(--nb-border))] group-hover:shadow-[8px_8px_0_0_hsl(var(--nb-border))] group-hover:-translate-x-1 group-hover:-translate-y-1 transition-all flex flex-col">
                  <span className="text-[11px] font-medium text-black/40">
                    {new Date(p.published_at).toLocaleDateString(isAr ? "ar" : "en-US", { year: "numeric", month: "short", day: "2-digit", calendar: "gregory" })}
                  </span>
                  <h3 className="mt-3 text-[17px] font-semibold leading-tight" style={{ color: "#3F5A63" }}>
                    {isAr ? p.title_ar : p.title_en}
                  </h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-black/65 flex-1">
                    {isAr ? p.excerpt_ar : p.excerpt_en}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#3F5A63]">
                    {t.readMore}
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <SiteFooter />
    </div>
  );
};

export default Blog;
