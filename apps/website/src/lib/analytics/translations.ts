import type { Translation } from 'vanilla-cookieconsent'

export function consentTranslation(locale: 'en' | 'ja'): Translation {
  const ja = locale === 'ja'
  return {
    consentModal: {
      title: ja ? 'アクセス解析について' : 'Website analytics',
      description: ja
        ? 'サイト改善のため、Google AnalyticsとVercel Web Analyticsを使用します。許可するとGoogleの解析用Cookieを使用し、利用情報をGoogleとVercelへ送信します。拒否してもサイトの機能は変わりません。'
        : 'We use Google Analytics and Vercel Web Analytics to improve this site. Allowing analytics enables Google analytics cookies and sends usage information to Google and Vercel. Rejecting does not affect site functionality.',
      acceptAllBtn: ja ? '許可する' : 'Allow analytics',
      acceptNecessaryBtn: ja ? '拒否する' : 'Reject analytics',
      showPreferencesBtn: ja ? '設定を見る' : 'Preferences',
      footer: `<a href="/${locale}/privacy">${ja ? 'プライバシーについて' : 'Privacy information'}</a>`,
    },
    preferencesModal: {
      title: ja ? 'アクセス解析の設定' : 'Analytics preferences',
      acceptAllBtn: ja ? '解析を許可' : 'Allow analytics',
      acceptNecessaryBtn: ja ? '解析を拒否' : 'Reject analytics',
      savePreferencesBtn: ja ? '設定を保存' : 'Save preferences',
      closeIconLabel: ja ? '閉じる' : 'Close',
      sections: [
        {
          title: ja ? 'サイトの基本設定' : 'Site preferences',
          description: ja
            ? '言語・表示テーマ・解析の選択を保存します。'
            : 'Stores your language, display theme and analytics choices.',
          linkedCategory: 'necessary',
        },
        {
          title: 'Google Analytics / Vercel Web Analytics',
          description: ja
            ? '閲覧ページ、参照元、端末情報などをGoogleとVercelへ送信します。日本からのアクセスでは初期状態で有効です。ここからいつでも停止できます。停止時は計測を止めるためページを再読み込みします。'
            : 'Sends page visits, referrers and device information to Google and Vercel. Enabled by default for visits from Japan. You can disable it here at any time; disabling reloads the page to stop tracking.',
          linkedCategory: 'analytics',
        },
      ],
    },
  }
}
