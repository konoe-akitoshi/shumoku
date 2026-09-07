<script lang="ts">
  import AnalyticsSettings from '$lib/analytics/AnalyticsSettings.svelte'
  import PageHeading from '$lib/layout/PageHeading.svelte'
  import PageMeta from '$lib/PageMeta.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  const ja = $derived(data.lang === 'ja')
  const title = $derived(ja ? 'プライバシーとアクセス解析' : 'Privacy and website analytics')
  const description = $derived(
    ja
      ? 'このウェブサイトの解析と保存される設定について。'
      : 'Analytics and preferences stored by this website.',
  )
</script>
<PageMeta {title} {description} />
<main id="main">
  <PageHeading {title} {description} />
  <div class="site-container privacy-content">
    {#if ja}
      <h2>Google Analytics</h2>
      <p>
        Shumokuのウェブサイトでは、利用状況の把握と改善のためGoogle Analytics
        4（G-SHX2VE8F8F）を利用します。有効な場合、閲覧URL、参照元、ブラウザ・端末情報、操作イベント、Cookieによる識別子などがGoogleへ送信されます。通信にはIPアドレスが伴います。
      </p>
      <p>
        この実装ではGoogleシグナルと広告パーソナライズを無効にし、氏名・メールアドレス・Playgroundの入力内容を独自イベントとして送信しません。URLには秘密情報を含めないでください。
      </p>
      <h2>Vercel Web Analytics</h2>
      <p>
        Vercel Web
        Analyticsでも閲覧状況を計測します。解析用Cookieは使用せず、ページ、参照元、端末や地域などの情報を扱います。この実装では送信する閲覧URLからクエリとハッシュを除き、独自イベントは送信しません。下記の地域判定と許可・拒否は両方の解析に適用します。
        <a href="https://vercel.com/docs/analytics/privacy-policy">Vercelの解析とプライバシー</a>
      </p>
      <h2>地域による動作と選択</h2>
      <p>
        VercelがIPアドレスから推定した国情報を使います。日本からのアクセスでは、拒否の保存がなければ解析を有効にします。それ以外、または国が不明な場合は、許可するまでGoogleの解析タグを読み込みません。地域判定の通信に失敗した場合も計測しません。
      </p>
      <p>
        許可・拒否の選択はこのサイトに180日間保存します。日本でも下の設定から拒否できます。解析を停止すると、タグによる計測を終了するためページを再読み込みします。拒否してもサイトの機能は利用できます。
      </p>
      <h2>保存する情報</h2>
      <p>
        解析用Cookie（_ga、_ga_SHX2VE8F8F）の有効期間は最大180日です。同意設定はshumoku_consentに保存します。ほかに、手動で選んだ言語をCookie、表示テーマをlocalStorageに保存します。これらの設定は解析への同意とは独立しています。
      </p>
      <p>
        Googleによる情報の利用については、<a href="https://policies.google.com/privacy"
          >Googleのプライバシーポリシー</a
        >と<a href="https://policies.google.com/technologies/partner-sites"
          >Googleのサービスを使用するサイトからの情報の扱い</a
        >をご確認ください。
      </p>
      <p>
        この説明はwww.shumoku.devとshumoku.devのHPに適用します。DocsとEditorには、この変更によるGA4の追加は行っていません。
      </p>
      <p>お問い合わせ：<a href="mailto:contact@shumoku.dev">contact@shumoku.dev</a></p>
    {:else}
      <h2>Google Analytics</h2>
      <p>
        The Shumoku website uses Google Analytics 4 (G-SHX2VE8F8F) to understand usage and improve
        the site. When enabled, page URLs, referrers, browser and device information, interaction
        events and cookie identifiers are sent to Google. Network requests include your IP address.
      </p>
      <p>
        This integration disables Google signals and advertising personalization. It does not send
        names, email addresses or Playground input as custom events. Do not include confidential
        information in URLs.
      </p>
      <h2>Vercel Web Analytics</h2>
      <p>
        We also use Vercel Web Analytics for page visits, referrers, device and regional
        information, without analytics cookies. This integration removes query strings and hashes
        from page URLs and sends no custom events. The regional policy and your analytics choice
        below apply to both services.
        <a href="https://vercel.com/docs/analytics/privacy-policy"
          >Vercel analytics privacy information</a
        >
      </p>
      <h2>Regional behavior and your choice</h2>
      <p>
        We use the country estimated by Vercel from your IP address. For visits from Japan,
        analytics is enabled unless a rejection has been saved. For other or unknown countries, the
        Google analytics tag is not loaded until you allow it. If the region request fails,
        analytics remains disabled.
      </p>
      <p>
        Your choice is saved on this site for 180 days. You can reject analytics below, including in
        Japan. Disabling analytics reloads the page to stop the loaded tag. Rejecting does not
        affect website functionality.
      </p>
      <h2>Stored preferences</h2>
      <p>
        Analytics cookies (_ga and _ga_SHX2VE8F8F) expire after at most 180 days. The
        shumoku_consent cookie stores your analytics choice. Your manually selected language is also
        saved in a cookie, and the display theme in localStorage, independently of analytics
        consent.
      </p>
      <p>
        See <a href="https://policies.google.com/privacy">Google’s Privacy Policy</a> and
        <a href="https://policies.google.com/technologies/partner-sites"
          >how Google uses information from partner sites</a
        >
        for details of its data processing.
      </p>
      <p>
        This notice covers the homepage application on www.shumoku.dev and shumoku.dev. This
        integration does not add GA4 to Docs or Editor.
      </p>
      <p>Questions: <a href="mailto:contact@shumoku.dev">contact@shumoku.dev</a></p>
    {/if}
    <AnalyticsSettings locale={data.lang} />
  </div>
</main>
<style>
  .privacy-content {
    padding-bottom: 4rem;
  }
  h2 {
    margin-top: 2rem;
    font-size: 1.25rem;
    font-weight: 600;
  }
  p {
    margin-top: 1rem;
    max-width: 48rem;
    line-height: 1.9;
  }
  a {
    text-decoration: underline;
    text-underline-offset: 4px;
  }
</style>
