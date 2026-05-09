const translations = {
  en: {
    title: "TidyGroup-Solo - Smart Tab Group Organizer for Chrome",
    description: "Clean up and organize your tab groups with ease. Privacy-focused and works completely offline.",
    usage: "Usage",
    privacy: "Privacy Policy",
    tagline: "〜Smartly organize and cleanse accumulated and duplicated tab groups〜",
    cta: "Add to Chrome Web Store (Coming Soon)",
    projectOverview: "Project Overview",
    overviewText:
      "TidyGroup-Solo is a tab group management and organization tool designed with privacy as the top priority. Based on the 'KonMari' method, it helps you keep only the 'joy-sparking' groups you need now, dramatically improving browser visibility and work efficiency.",
    features: "Features",
    featureMerge: "Smart Merge",
    featureMergeText:
      "Consolidates multiple duplicate saved entries into one and integrates them as the latest URL list.",
    featureCleanup: "Batch Cleanup",
    featureCleanupText:
      "Deletes 'hibernating' groups that are empty or haven't been updated for a long time at once to keep the list clean.",
    featureLocal: "Complete Local Execution",
    featureLocalText:
      "All data is stored within the browser. No data is ever sent to external servers, strongly protecting your privacy.",
    featureM3: "Material 3 UI",
    featureM3Text:
      "Adopts Google Material 3 (M3) design. Operates comfortably in the side panel without interrupting your work.",
    install: "How to Install",
    installStep1: "Download the source code from the repository.",
    installStep2: "Select 'Load unpacked' on the Chrome extensions page (chrome://extensions).",
    installStep3: "Select the 'projects/app' folder to complete the installation.",
    copyright: "© 2026 TidyGroup-Solo. All rights reserved.",
    privacyTitle: "Privacy Policy - TidyGroup-Solo",
    usageTitle: "Usage - TidyGroup-Solo",
    backToHome: "Back to Home",
    langEn: "English",
    langJa: "日本語",
  },
  ja: {
    title: "TidyGroup-Solo - スマートなタブグループ整理ツール",
    description: "大量に蓄積し、重複したタブグループをスマートに整理・クレンジング。プライバシー重視で完全にオフラインで動作します。",
    usage: "使い方",
    privacy: "プライバシーポリシー",
    tagline: "〜大量に蓄積し、重複したタブグループをスマートに整理・クレンジング〜",
    cta: "Chrome ウェブストアで追加（準備中）",
    projectOverview: "プロジェクト概要",
    overviewText:
      "TidyGroup-Soloは、プライバシーを最優先に設計されたタブグループ管理・整理ツールです。「こんまり」流の整理術に基づき、今必要な「ときめく」グループだけが残る状態を実現し、ブラウザの視認性と作業効率を劇的に向上させます。",
    features: "特徴",
    featureMerge: "スマート・マージ",
    featureMergeText:
      "重複する複数の保存済みエントリを一つに集約し、最新のURLリストとして統合します。",
    featureCleanup: "一括クレンジング",
    featureCleanupText:
      "中身が空、あるいは長期間更新がない「冬眠中」のグループを一括消去し、リストをクリーンに保ちます。",
    featureLocal: "完全ローカル実行",
    featureLocalText:
      "すべてのデータはブラウザ内に保存されます。外部サーバーへの送信は一切行われず、プライバシーを強力に保護します。",
    featureM3: "Material 3 UI",
    featureM3Text:
      "Google Material 3 (M3) デザインを採用。サイドパネルで作業を邪魔せず、快適に操作できます。",
    install: "インストール方法",
    installStep1: "リポジトリからソースコードをダウンロードします。",
    installStep2: "Chromeの拡張機能ページ（chrome://extensions）で「パッケージ化されていない拡張機能を読み込む」を選択します。",
    installStep3: "「projects/app」フォルダを選択してインストール完了です。",
    copyright: "© 2026 TidyGroup-Solo. All rights reserved.",
    privacyTitle: "プライバシーポリシー - TidyGroup-Solo",
    usageTitle: "使い方 - TidyGroup-Solo",
    backToHome: "ホームに戻る",
    langEn: "English",
    langJa: "日本語",
  },
};

function applyTranslations() {
  const userLang = navigator.language.startsWith("ja") ? "ja" : "en";
  const lang = localStorage.getItem("preferred-lang") || userLang;
  const t = translations[lang];

  document.documentElement.lang = lang;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (t[key]) {
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        el.placeholder = t[key];
      } else {
        el.textContent = t[key];
      }
    }
  });

  const pageKey = document.body.dataset.page;
  const titleKey = pageKey ? `${pageKey}Title` : "title";
  const finalTitle = t[titleKey] || t.title;

  document.title = finalTitle;

  const metaTitle = document.querySelector('meta[name="title"]');
  if (metaTitle) metaTitle.setAttribute("content", finalTitle);

  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc && t.description) metaDesc.setAttribute("content", t.description);

  document.querySelectorAll(".lang-switch").forEach((btn) => {
    const isActive = btn.dataset.lang === lang;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-pressed", isActive);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  applyTranslations();

  document.querySelectorAll(".lang-switch").forEach((btn) => {
    btn.addEventListener("click", () => {
      localStorage.setItem("preferred-lang", btn.dataset.lang);
      applyTranslations();
    });
  });
});
