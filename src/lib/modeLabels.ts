// Display names for every game mode, shared by the history list and analytics.
export const MODE_LABEL: Record<string, { ar: string; en: string }> = {
  classic: { ar: "كلاسيكي", en: "Classic" },
  crypto_rush: { ar: "حرب الاختراقات", en: "Cyber War" },
  // removed mode, kept so old games still have a name
  dodgeball: { ar: "المراوغة", en: "Dodgeball" },
  hotpotato: { ar: "مرّرها", en: "Pass It" },
  lavafloor: { ar: "أرضية الحمم", en: "Lava Floor" },
  humansvszombies: { ar: "البشر ضد الزومبي", en: "Humans vs Zombies" },
  dontlookdown: { ar: "لا تنظر للأسفل", en: "Don't Look Down" },
  paintfight: { ar: "معركة الطلاء", en: "Paint Fight" },
  physical: { ar: "الألعاب الفيزيائية", en: "Physical" },
  homework: { ar: "واجب منزلي", en: "Homework" },
};

export const modeName = (mode: string | undefined | null, ar: boolean) =>
  (mode && MODE_LABEL[mode]?.[ar ? "ar" : "en"]) || (ar ? "حرب الاختراقات" : "Cyber War");
