export function getWebApp() {
  return window.Telegram?.WebApp || null;
}

export function getInitData() {
  return getWebApp()?.initData || "";
}

export function initTelegram() {
  const webApp = getWebApp();
  if (!webApp) return;

  webApp.ready();
  webApp.expand();
  applyTheme(webApp.themeParams || {});

  webApp.onEvent("themeChanged", () => {
    applyTheme(webApp.themeParams || {});
  });
}

function applyTheme(params) {
  const root = document.documentElement;
  root.style.setProperty("--tg-bg", params.bg_color || "#ffffff");
  root.style.setProperty("--tg-text", params.text_color || "#111111");
  root.style.setProperty("--tg-hint", params.hint_color || "#6b7280");
  root.style.setProperty("--tg-link", params.link_color || "#2563eb");
  root.style.setProperty("--tg-button", params.button_color || "#1d4ed8");
  root.style.setProperty("--tg-button-text", params.button_text_color || "#ffffff");
}
