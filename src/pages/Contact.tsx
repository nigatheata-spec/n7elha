// ── Contact us ──────────────────────────────────────────────────────────────
// A real form, but deliberately backend-free: submitting composes a mailto to
// the support inbox with everything already filled in. That keeps the page
// working the moment it ships — no table, no RLS policy, no edge function, and
// nothing to break silently when a teacher writes in. If inbound volume ever
// justifies a real inbox, swap `send()` for an insert and keep the markup.

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Mail, Send, School, UserRound, MessageSquare, Clock } from "lucide-react";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Seo } from "@/components/Seo";

const SUPPORT_EMAIL = "hello@nefelha.com";

type Topic = "school" | "teacher" | "other";

const Contact = () => {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [school, setSchool] = useState("");
  const [topic, setTopic] = useState<Topic>("teacher");
  const [message, setMessage] = useState("");

  const t = isAr
    ? {
        kicker: "تواصل معنا",
        title: "عندك سؤال؟ إحنا نسمعك",
        sub: "املأ النموذج وبيفتح لك بريدك جاهز للإرسال، أو راسلنا مباشرة على بريد الدعم.",
        formTitle: "أرسل رسالة",
        name: "الاسم",
        namePh: "اسمك الكامل",
        email: "البريد الإلكتروني",
        emailPh: "you@school.edu.sa",
        school: "المدرسة (اختياري)",
        schoolPh: "اسم مدرستك",
        topic: "الموضوع",
        topicSchool: "مدرسة أو إدارة تعليمية",
        topicTeacher: "معلم فردي",
        topicOther: "شيء آخر",
        message: "الرسالة",
        messagePh: "كيف نقدر نساعدك؟",
        send: "أرسل الرسالة",
        directTitle: "أو راسلنا مباشرة",
        directDesc: "نقرأ كل رسالة تصلنا، وعادةً نرد خلال يوم عمل واحد.",
        replyTime: "الرد خلال يوم عمل",
        schoolsTitle: "للمدارس",
        schoolsDesc: "تبي تفعّل نفلها على مستوى عدة صفوف أو معلمين؟ نساعدك في الإعداد من البداية.",
        teachersTitle: "للمعلمين",
        teachersDesc: "سؤال عن ميزة، مشكلة تقنية، أو فكرة لنمط لعب جديد؟ راسلنا.",
      }
    : {
        kicker: "CONTACT",
        title: "Have a question? We're listening",
        sub: "Fill in the form and it opens your email ready to send, or write to our support inbox directly.",
        formTitle: "Send a message",
        name: "Name",
        namePh: "Your full name",
        email: "Email",
        emailPh: "you@school.edu.sa",
        school: "School (optional)",
        schoolPh: "Your school's name",
        topic: "Topic",
        topicSchool: "School or district",
        topicTeacher: "Individual teacher",
        topicOther: "Something else",
        message: "Message",
        messagePh: "How can we help?",
        send: "Send message",
        directTitle: "Or reach us directly",
        directDesc: "We read every message that comes in, and usually reply within one working day.",
        replyTime: "Reply within a working day",
        schoolsTitle: "For schools",
        schoolsDesc: "Rolling nefelha out across several classes or teachers? We'll help you set it up.",
        teachersTitle: "For teachers",
        teachersDesc: "A question about a feature, a technical issue, or an idea for a new game mode? Write in.",
      };

  const topicLabel: Record<Topic, string> = {
    school: t.topicSchool,
    teacher: t.topicTeacher,
    other: t.topicOther,
  };

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = `[${topicLabel[topic]}] ${name.trim() || "nefelha"}`;
    const body = [
      `${t.name}: ${name}`,
      `${t.email}: ${email}`,
      school.trim() ? `${t.school}: ${school}` : null,
      `${t.topic}: ${topicLabel[topic]}`,
      "",
      message,
    ]
      .filter(Boolean)
      .join("\n");
    window.location.href =
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const canSend = name.trim() && email.trim() && message.trim();

  const field =
    "w-full rounded-xl border-2 border-[hsl(var(--nb-border))] bg-white px-4 py-3 text-[14px] text-black placeholder:text-black/30 focus:outline-none focus:shadow-[3px_3px_0_0_hsl(var(--nb-border))] transition-shadow";
  const label = "block text-[12px] font-semibold tracking-widest uppercase text-black/40 mb-2";

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: "hsl(var(--cream-panel))", fontFamily: "'Outfit', 'Almarai', system-ui, sans-serif" }}
    >
      <Seo
        path="/contact"
        titleAr="تواصل معنا — نفلها"
        titleEn="Contact Us — nefelha"
        descriptionAr="راسل فريق نفلها. أسئلة المعلمين، شراكات المدارس، والدعم الفني — نقرأ كل رسالة ونرد خلال يوم عمل."
        descriptionEn="Get in touch with the nefelha team. Teacher questions, school partnerships, and technical support — we read every message and reply within a working day."
      />
      <SiteNav />

      {/* ---------------- HERO ---------------- */}
      <section className="wrap px-5 sm:px-8 md:px-14 pt-10 sm:pt-16 pb-10">
        <span className={`text-[12px] font-semibold text-[#3F5A63] ${isAr ? "tracking-normal" : "tracking-[0.25em]"}`}>
          {t.kicker}
        </span>
        <h1
          className="mt-3 max-w-2xl leading-[1.1] tracking-tight text-[32px] sm:text-[46px]"
          style={{ fontFamily: "'ArslanWessam', 'Almarai', sans-serif", color: "#3F5A63" }}
        >
          {t.title}
        </h1>
        <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-black/65">{t.sub}</p>
      </section>

      {/* ---------------- FORM + SIDEBAR ---------------- */}
      <section className="wrap px-5 sm:px-8 md:px-14 pb-20 sm:pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">

          <form
            onSubmit={send}
            className="rounded-2xl border-2 border-[hsl(var(--nb-border))] bg-white p-6 sm:p-8 shadow-[5px_5px_0_0_hsl(var(--nb-border))] space-y-5"
          >
            <h2 className="text-[18px] font-semibold" style={{ color: "#3F5A63" }}>{t.formTitle}</h2>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={label} htmlFor="c-name">{t.name}</label>
                <input id="c-name" required value={name} onChange={e => setName(e.target.value)}
                  placeholder={t.namePh} className={field} />
              </div>
              <div>
                <label className={label} htmlFor="c-email">{t.email}</label>
                <input id="c-email" required type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder={t.emailPh} className={field} dir="ltr" />
              </div>
            </div>

            <div>
              <label className={label} htmlFor="c-school">{t.school}</label>
              <input id="c-school" value={school} onChange={e => setSchool(e.target.value)}
                placeholder={t.schoolPh} className={field} />
            </div>

            <div>
              <span className={label}>{t.topic}</span>
              <div className="flex flex-wrap gap-2">
                {(["school", "teacher", "other"] as Topic[]).map(id => {
                  const active = topic === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTopic(id)}
                      aria-pressed={active}
                      className={`rounded-full border-2 border-[hsl(var(--nb-border))] px-4 py-2 text-[13px] font-semibold transition-all ${
                        active
                          ? "bg-[#3F5A63] text-white shadow-[3px_3px_0_0_hsl(var(--nb-border))]"
                          : "bg-white text-[#3F5A63] hover:bg-black/[0.03]"
                      }`}
                    >
                      {topicLabel[id]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className={label} htmlFor="c-msg">{t.message}</label>
              <textarea id="c-msg" required rows={6} value={message} onChange={e => setMessage(e.target.value)}
                placeholder={t.messagePh} className={`${field} resize-y min-h-[140px]`} />
            </div>

            <button
              type="submit"
              disabled={!canSend}
              className="inline-flex items-center gap-2 rounded-full border-2 border-[hsl(var(--nb-border))] bg-[#8FC44A] px-6 py-3 text-[14px] font-semibold text-[#3F5A63] shadow-[4px_4px_0_0_hsl(var(--nb-border))] hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_0_hsl(var(--nb-border))] transition-all disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0_0_hsl(var(--nb-border))]"
            >
              <Send className="h-4 w-4" />
              {t.send}
            </button>
          </form>

          {/* ── Sidebar ── */}
          <div className="space-y-4">
            <div className="rounded-2xl border-2 border-[hsl(var(--nb-border))] bg-[#14212A] text-white p-6 shadow-[5px_5px_0_0_hsl(var(--nb-border))]">
              <MessageSquare className="h-5 w-5 text-[#8FC44A]" />
              <h3 className="mt-4 text-[16px] font-semibold">{t.directTitle}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-white/55">{t.directDesc}</p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="mt-4 inline-flex items-center gap-2 rounded-full border-2 border-[#22333A] bg-white px-4 py-2.5 text-[13px] font-medium text-black shadow-[3px_3px_0_0_#22333A] hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_0_#22333A] transition-all"
                dir="ltr"
              >
                <Mail className="h-4 w-4 text-[#3F5A63]" />
                {SUPPORT_EMAIL}
              </a>
              <div className="mt-4 flex items-center gap-2 text-[12px] text-white/40">
                <Clock className="h-3.5 w-3.5" />
                {t.replyTime}
              </div>
            </div>

            <SideCard icon={<School className="h-5 w-5" />} bg="#3F5A63" fg="#fff"
              title={t.schoolsTitle} desc={t.schoolsDesc} />
            <SideCard icon={<UserRound className="h-5 w-5" />} bg="#8FC44A" fg="#3F5A63"
              title={t.teachersTitle} desc={t.teachersDesc} />
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
};

const SideCard = ({ icon, bg, fg, title, desc }: {
  icon: React.ReactNode; bg: string; fg: string; title: string; desc: string;
}) => (
  <div className="rounded-2xl border-2 border-[hsl(var(--nb-border))] bg-white p-6 shadow-[5px_5px_0_0_hsl(var(--nb-border))]">
    <div className="h-10 w-10 rounded-xl border-2 border-[hsl(var(--nb-border))] flex items-center justify-center"
      style={{ background: bg, color: fg }}>
      {icon}
    </div>
    <h3 className="mt-4 text-[16px] font-semibold" style={{ color: "#3F5A63" }}>{title}</h3>
    <p className="mt-2 text-[13px] leading-relaxed text-black/60">{desc}</p>
  </div>
);

export default Contact;
