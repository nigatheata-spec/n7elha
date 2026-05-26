import { Check, Zap, Users, Building2, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  name: string;
  nameAr: string;
  price: string;
  priceNote: string;
  priceNoteAr: string;
  description: string;
  descriptionAr: string;
  features: PlanFeature[];
  featuresAr: { text: string; included: boolean }[];
  icon: React.ReactNode;
  popular?: boolean;
  ctaHref: string;
  ctaLabel: string;
  ctaLabelAr: string;
}

const plans: Plan[] = [
  {
    name: "Free",
    nameAr: "مجاني",
    price: "0",
    priceNote: "forever",
    priceNoteAr: "للأبد",
    description: "Perfect for getting started",
    descriptionAr: "مثالي للبداية",
    icon: <Zap className="h-5 w-5" />,
    ctaHref: "/auth?mode=signup",
    ctaLabel: "Get started",
    ctaLabelAr: "ابدأ الآن",
    features: [
      { text: "Up to 30 students per game", included: true },
      { text: "3 quizzes saved", included: true },
      { text: "Basic analytics", included: true },
      { text: "Manual quiz builder", included: true },
      { text: "AI question generation", included: false },
      { text: "Dodgeball game mode", included: false },
      { text: "Export reports", included: false },
    ],
    featuresAr: [
      { text: "حتى ٣٠ طالب في اللعبة", included: true },
      { text: "٣ اختبارات محفوظة", included: true },
      { text: "تحليلات أساسية", included: true },
      { text: "منشئ الاختبارات اليدوي", included: true },
      { text: "توليد الأسئلة بالذكاء الاصطناعي", included: false },
      { text: "وضع Dodgeball", included: false },
      { text: "تصدير التقارير", included: false },
    ],
  },
  {
    name: "Teacher",
    nameAr: "المعلم",
    price: "29",
    priceNote: "per month",
    priceNoteAr: "شهرياً",
    description: "Everything a classroom needs",
    descriptionAr: "كل ما يحتاجه الفصل",
    icon: <Users className="h-5 w-5" />,
    popular: true,
    ctaHref: "/auth?mode=signup",
    ctaLabel: "Start free trial",
    ctaLabelAr: "جرّب مجاناً",
    features: [
      { text: "Unlimited students", included: true },
      { text: "Unlimited quizzes", included: true },
      { text: "Full analytics dashboard", included: true },
      { text: "Manual quiz builder", included: true },
      { text: "AI question generation", included: true },
      { text: "Dodgeball game mode", included: true },
      { text: "Export reports (PDF/CSV)", included: true },
    ],
    featuresAr: [
      { text: "طلاب غير محدودين", included: true },
      { text: "اختبارات غير محدودة", included: true },
      { text: "لوحة تحليلات كاملة", included: true },
      { text: "منشئ الاختبارات اليدوي", included: true },
      { text: "توليد الأسئلة بالذكاء الاصطناعي", included: true },
      { text: "وضع Dodgeball", included: true },
      { text: "تصدير التقارير (PDF/CSV)", included: true },
    ],
  },
  {
    name: "School",
    nameAr: "المدرسة",
    price: "149",
    priceNote: "per month",
    priceNoteAr: "شهرياً",
    description: "For entire schools & institutions",
    descriptionAr: "للمدارس والمؤسسات",
    icon: <Building2 className="h-5 w-5" />,
    ctaHref: "mailto:hello@n7elha.com",
    ctaLabel: "Contact us",
    ctaLabelAr: "تواصل معنا",
    features: [
      { text: "Up to 20 teacher accounts", included: true },
      { text: "Unlimited students", included: true },
      { text: "Admin dashboard", included: true },
      { text: "All Teacher features", included: true },
      { text: "AI question generation", included: true },
      { text: "Custom branding", included: true },
      { text: "Priority support", included: true },
    ],
    featuresAr: [
      { text: "حتى ٢٠ حساب معلم", included: true },
      { text: "طلاب غير محدودين", included: true },
      { text: "لوحة إدارة المدرسة", included: true },
      { text: "جميع مميزات المعلم", included: true },
      { text: "توليد الأسئلة بالذكاء الاصطناعي", included: true },
      { text: "هوية بصرية مخصصة", included: true },
      { text: "دعم ذو أولوية", included: true },
    ],
  },
];

interface CreativePricingProps {
  isAr?: boolean;
}

export const CreativePricing = ({ isAr = false }: CreativePricingProps) => {
  return (
    <section id="pricing" className="px-5 sm:px-8 md:px-14 py-16 sm:py-24 border-t border-black/5">
      <div className="max-w-2xl mb-10 sm:mb-14">
        <span className="text-[12px] tracking-[0.25em] font-semibold text-[#FF8254]">
          {isAr ? "الأسعار" : "PRICING"}
        </span>
        <h2 className="mt-3 text-[28px] sm:text-[40px] font-semibold tracking-tight text-black leading-[1.1]">
          {isAr ? "خطة لكل فصل" : "A plan for every classroom"}
          <span className="font-handwritten text-[#FF8254] ms-3 text-[32px] sm:text-[48px] font-normal">
            {isAr ? "حرفياً" : "literally"}
          </span>
        </h2>
        <p className="mt-4 text-[15px] text-black/65 leading-relaxed">
          {isAr
            ? "ابدأ مجاناً وطوّر عند الحاجة. لا بطاقة ائتمان مطلوبة للبدء."
            : "Start free, upgrade when you need it. No credit card required to begin."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
        {plans.map((plan) => (
          <PricingCard key={plan.name} plan={plan} isAr={isAr} />
        ))}
      </div>
    </section>
  );
};

const PricingCard = ({ plan, isAr }: { plan: Plan; isAr: boolean }) => {
  const features = isAr ? plan.featuresAr : plan.features;

  return (
    <div
      className={cn(
        "relative rounded-2xl border p-7 flex flex-col transition-all hover:shadow-[0_20px_50px_-20px_rgba(63,90,99,0.2)]",
        plan.popular
          ? "bg-[#3F5A63] border-[#3F5A63] text-white shadow-[0_24px_60px_-20px_rgba(63,90,99,0.35)]"
          : "bg-white border-black/10 text-black hover:border-[#FF8254]/30"
      )}
    >
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="font-handwritten text-[15px] px-4 py-1 rounded-full bg-[#FF8254] text-white shadow-sm">
            {isAr ? "الأكثر شيوعاً" : "Most popular"}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
            plan.popular ? "bg-white/15 text-white" : "bg-[#FF8254]/10 text-[#FF8254]"
          )}
        >
          {plan.icon}
        </div>
        <div>
          <div className={cn("text-[15px] font-semibold", plan.popular ? "text-white" : "text-black")}>
            {isAr ? plan.nameAr : plan.name}
          </div>
          <div className={cn("text-[12px]", plan.popular ? "text-white/65" : "text-black/50")}>
            {isAr ? plan.descriptionAr : plan.description}
          </div>
        </div>
      </div>

      {/* Price */}
      <div className="mb-6">
        <div className="flex items-end gap-1.5">
          <span className={cn("text-[13px] mt-1", plan.popular ? "text-white/70" : "text-black/50")}>$</span>
          <span className={cn("text-[42px] font-bold leading-none tracking-tighter", plan.popular ? "text-white" : "text-black")}>
            {plan.price}
          </span>
          <span className={cn("text-[13px] mb-1.5", plan.popular ? "text-white/60" : "text-black/45")}>
            /{isAr ? plan.priceNoteAr : plan.priceNote}
          </span>
        </div>
      </div>

      {/* Features */}
      <ul className="space-y-3 flex-1 mb-7">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span
              className={cn(
                "mt-[2px] h-4 w-4 rounded-full flex items-center justify-center shrink-0",
                f.included
                  ? plan.popular
                    ? "bg-white/20 text-white"
                    : "bg-[#FF8254]/12 text-[#FF8254]"
                  : plan.popular
                  ? "bg-white/8 text-white/30"
                  : "bg-black/5 text-black/25"
              )}
            >
              <Check className="h-2.5 w-2.5" strokeWidth={2.5} />
            </span>
            <span
              className={cn(
                "text-[13.5px] leading-snug",
                f.included
                  ? plan.popular
                    ? "text-white/90"
                    : "text-black/75"
                  : plan.popular
                  ? "text-white/35 line-through"
                  : "text-black/30 line-through"
              )}
            >
              {f.text}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <Link
        to={plan.ctaHref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold transition-all active:scale-[0.98]",
          plan.popular
            ? "bg-[#FF8254] text-white hover:brightness-105"
            : "bg-black/6 text-black hover:bg-[#3F5A63] hover:text-white"
        )}
      >
        {isAr ? plan.ctaLabelAr : plan.ctaLabel}
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    </div>
  );
};
