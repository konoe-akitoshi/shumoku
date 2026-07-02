export type AboutTranslations = {
  title: string
  lead: string
  name: {
    heading: string
    paragraphs: readonly string[]
  }
  logo: {
    heading: string
    paragraphs: readonly string[]
  }
  philosophy: {
    heading: string
    quote: string
    quoteEn: string
    paragraphs: readonly string[]
    conditions: readonly { title: string; description: string }[]
    layers: readonly { title: string; description: string }[]
    principlesHeading: string
    principles: readonly { title: string; description: string }[]
  }
  sources: {
    heading: string
    origin: string
    philosophy: string
  }
}

export const aboutTranslations = {
  en: {
    title: 'About Shumoku',
    lead: 'Where the name and the logo come from, and the thinking that shapes every design decision in Shumoku.',
    name: {
      heading: 'Origin of the name',
      paragraphs: [
        "The name shumoku comes from a hanshō — a hand bell — that hangs in my family's tea room. One day, sitting idly in the room, I found myself looking at the bell and the fixture that held it: a hook shaped like the three wise monkeys, several points tied together into a single quiet structure. It looked, oddly, like a network topology — devices are never just scattered points; there are connections, paths, dependencies, an order that isn't visible at first glance. Making that order visible is what a network topology diagram does.",
        'The hanshō is struck to announce the start of a tea gathering. The sound marks a beginning — people gather, attention shifts, the gathering starts. A network topology plays a similar role: once the structure is shown, people can understand it, build on it, operate it, and protect it.',
        'The stick used to strike the bell is called a shumoku (撞木). The small hook that quietly holds the shumoku in place is a shumoku-kugi (撞木釘). The name comes from there. Shumoku the project does not operate the network directly — but it supports the configuration data, the monitoring data, the inventory, the metrics, and the relationships between devices, keeping them ready to use when they are needed. Just as the hook quietly holds the striker, Shumoku aims to be a small, quiet foundation for the start of network operations.',
      ],
    },
    logo: {
      heading: 'Origin of the logo',
      paragraphs: [
        "The Shumoku logo is modeled on Gabriel's wings.",
        "A network topology isn't something people invent out of nothing. It already exists — as the connections between devices, the paths traffic takes, the dependencies between systems. Most of the time, that structure simply stays invisible, buried inside a complex configuration. A network diagram reads that hidden structure and shows it to the people who operate the network. It doesn't create the structure; it gives an outline to a relationship that was already there. It finds the order inside what looks like chaos, and brings what was unseen down into something you can see.",
        'That feeling is close to an "annunciation" — news that reveals something already true, but not yet known, changing how people see the world rather than simply adding information. A network diagram works the same way: which devices are connected, which paths carry traffic, where the dependencies sit, where to start building and what to watch — none of this is invented by the diagram. It is only made visible by it.',
        "The wing in the Shumoku logo is a symbol of that kind of announcement — not a loud, decorative flourish, but a quiet marker for the moment a hidden structure is finally shown, the moment the truth buried inside a network reaches the people who operate it, in the form of a diagram. The diagram doesn't build the structure; it is a sign that traces the shape of a structure that's already there.",
      ],
    },
    philosophy: {
      heading: 'Philosophy',
      quote:
        'From diagrams you draw and let go stale, to operational maps that keep up with reality.',
      quoteEn: "Network diagrams that don't drift away from reality.",
      paragraphs: [
        "WiFi doesn't fall from the sky. Behind the connectivity we use every day, without a second thought, there is a grounded structure of cables, switches, routers, and wiring — infrastructure someone designed, laid out, and keeps running. Infrastructure is real, and it's on the ground. That's exactly why it deserves to be seen: structure that stays invisible can't be understood, can't be trusted, and can't be relied on when it matters.",
        "A network diagram is not just paperwork. It's a map for understanding how devices connect, how traffic flows, what depends on what, and how far a failure can spread — a map people lean on during design, build, operations, and incident response. In practice, though, most diagrams are drawn by hand in slides or drawing tools, need updating every time the network changes, and eventually fall behind reality — at which point they start misleading the very people who trust them. What's needed isn't just a diagram with lines on it. It's a map that can be grasped, trusted, and kept up to date.",
      ],
      conditions: [
        {
          title: 'Readable',
          description: 'The overall structure and every connection are clear at a glance.',
        },
        {
          title: 'Trustworthy',
          description: 'Grounded in a source of truth from the real network, not guesswork.',
        },
        {
          title: 'Reproducible',
          description: 'Can be regenerated continuously as the network keeps changing.',
        },
      ],
      layers: [
        {
          title: 'Core',
          description:
            'Library + CLI — the heart of Diagram as Code. Reads YAML, NetBox, LLDP, and SNMP as a structured source of truth and turns them into a readable topology.',
        },
        {
          title: 'Editor',
          description:
            'The app for visually designing and editing a topology — placing devices, modules, and cables, down to the bill of materials.',
        },
        {
          title: 'Server',
          description:
            'The app for putting the generated map to work — overlaying live traffic, status, and alerts so operators can understand what is happening.',
        },
      ],
      principlesHeading: 'Six design principles',
      principles: [
        {
          title: 'Readable',
          description: 'Human-readable, legible, and clear about structure — the top priority.',
        },
        {
          title: 'Reproducible',
          description: 'Regenerable from YAML / JSON / Git / CI — Diagram as Code.',
        },
        {
          title: 'Reality-aware',
          description: 'Draws on real sources — NetBox, LLDP, SNMP, APIs.',
        },
        { title: 'Source-agnostic', description: "Doesn't lock into a single data source." },
        {
          title: 'Operational',
          description: 'Usable for NOC work, monitoring, incident response, and sharing.',
        },
        {
          title: 'Extensible',
          description: 'Extendable through plugins, vendor catalogs, and templates.',
        },
      ],
    },
    sources: {
      heading: 'Read the full story',
      origin: 'The full origin of the name and logo (GitHub)',
      philosophy: 'The full design philosophy (GitHub)',
    },
  },
  ja: {
    title: 'About Shumoku',
    lead: 'shumoku という名前とロゴがどこから来たのか、そしてすべての設計判断の拠り所になっている思想について。',
    name: {
      heading: '名前の由来',
      paragraphs: [
        'shumoku という名前は、実家のお茶室で見た喚鐘に由来しています。あるとき、ぼんやりとお茶室に座って、天井から吊り下げられた喚鐘を眺めていました。その喚鐘を支えている吊り具は三猿の形をしていて、複数の点が結ばれ、全体としてひとつの構造を成しているように見えました。それは、どこかネットワークトポロジーに似ていました。ネットワークは機器がただ並んでいるだけではなく、機器と機器のあいだには接続があり、経路があり、依存関係があり、見えない秩序があります。その関係性を見える形にしたものが、ネットワークトポロジーです。',
        '喚鐘は、茶会の始まりを告げるために鳴らされます。音が響くことで場が始まる。人が集まり、意識が切り替わり、茶会という時間が立ち上がる。ネットワークトポロジーも、それに近いものだと考えています。トポロジーがあることで、構築が始まり、監視が始まり、運用が始まります。',
        '喚鐘を鳴らす道具は撞木、そしてその撞木を掛けておく金具が撞木釘です。shumoku という名前は、そこから生まれました。shumoku は、ネットワークそのものを直接動かす道具ではありません。けれど、ネットワークの構成情報、監視情報、インベントリ、メトリクス、そして接続の関係性を、必要なときに扱える形で支えるためのものです。撞木釘が撞木を静かに支えるように、shumoku はネットワーク運用の始まりを支える小さな基点でありたいと考えています。',
      ],
    },
    logo: {
      heading: 'ロゴの由来',
      paragraphs: [
        'shumoku のロゴは、ガブリエルの羽をモチーフにしています。',
        'ネットワークトポロジーは、人が恣意的に作り出すものではありません。機器と機器の接続、経路、依存関係として、それはすでにそこに存在している構造です。ただ、その姿は多くの場合、目に見えないまま、複雑な構成の奥に隠れています。ネットワーク図は、その見えざる構造を読み取り、運用者の前に示すためのものです。構造を作ることではなく、すでに存在している関係性に輪郭を与えること。混沌のように見える構成の中から、そこにあった秩序を見出すこと。見えなかったものを、見える形へと降ろすことです。',
        'この感覚は、どこか「告知」に似ています。天使は、まだ人々の目には見えていない始まりを告げます。すでに起こっていること、しかしまだ知られていないことを、人の前に示す。それは単なる情報ではなく、世界の見方を変える知らせです。ネットワーク図もまた、ネットワークの中にすでに存在している真実を告げるものです。どの機器がつながっているのか、どの経路が使われているのか、どこに依存関係があるのか——それらは図が生み出すものではなく、図によって初めて人の前に示されるものです。',
        'shumoku の羽は、その告知の象徴です。派手に主張するための羽ではなく、見えざる構造が静かに示される瞬間を表す羽。図は構造を作るのではなく、すでにある構造に輪郭を与えるしるしでありたい、という思想を込めています。',
      ],
    },
    philosophy: {
      heading: '思想',
      quote: '構成図を、描いて古くなる資料から、実態に追従し続ける運用の地図へ。',
      quoteEn: "Network diagrams that don't drift away from reality.",
      paragraphs: [
        'WiFi は天から降ってくるわけではありません。私たちが日々あたりまえのように使う通信の裏には、ケーブルとスイッチとルータと配線でできた、地に足のついた構造があります。誰かが設計し、敷設し、維持している現実のインフラです。インフラは「ある」。地にある。だからこそ、見えたほうがいい。見えない構造は、理解されず、信頼されず、いざというとき頼れません。',
        'ネットワーク構成図は、単なる資料ではありません。機器の接続関係・通信経路・依存関係・障害の影響範囲を理解するための地図であり、設計・構築・運用・障害対応において人が頼りにするものです。しかし現実の構成図は手作業で作られ、構成変更のたびに更新が必要になり、やがて更新が追いつかず実態とずれた図が残ります。ずれた図は、かえって判断を誤らせます。必要なのは、ただ線が引かれた図ではなく、把握でき、信頼でき、更新できる地図です。',
      ],
      conditions: [
        { title: '把握できる', description: '全体像と接続関係が一目で読み取れる。' },
        { title: '信頼できる', description: '実ネットワークに基づく source of truth である。' },
        { title: '更新できる', description: '構成変更に追従し、継続的に再生成できる。' },
      ],
      layers: [
        {
          title: 'Core',
          description:
            'Library + CLI — Diagram as Code の心臓部。YAML・NetBox・LLDP・SNMP を構造化された source of truth として読み、読みやすいトポロジーに変換する。',
        },
        {
          title: 'Editor',
          description:
            '視覚的に設計・編集するアプリ。機器・モジュール・ケーブルを配置し、部材表（BOM）まで扱う。',
        },
        {
          title: 'Server',
          description:
            '生成された地図を現場で生かすアプリ。流量・状態・アラートを重ねて、運用者がネットワークの動きと現状を把握できるようにする。',
        },
      ],
      principlesHeading: '設計原則（6軸）',
      principles: [
        { title: 'Readable', description: '人間が読める・美しい・構造がわかる（最優先）。' },
        {
          title: 'Reproducible',
          description: 'YAML / JSON / Git / CI で再生成できる（Diagram as Code）。',
        },
        {
          title: 'Reality-aware',
          description: 'NetBox・LLDP・SNMP・API など実態に近い情報を使う。',
        },
        { title: 'Source-agnostic', description: '特定の情報源に閉じない。' },
        { title: 'Operational', description: 'NOC・監視・障害対応・共有で使える。' },
        { title: 'Extensible', description: 'plugins・vendor catalog・templates で広げられる。' },
      ],
    },
    sources: {
      heading: '全文はこちら',
      origin: '名前とロゴの由来（全文・GitHub）',
      philosophy: '設計思想（全文・GitHub）',
    },
  },
} as const

export type AboutLocale = keyof typeof aboutTranslations
