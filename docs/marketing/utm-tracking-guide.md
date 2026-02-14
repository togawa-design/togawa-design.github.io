# 広告トラッキングガイド

広告効果測定のためのUTMパラメータ設定ルールです。

*作成日: 2026-02-14*

---

## UTMパラメータとは

URLの末尾に付けるパラメータで、どの広告から応募が来たかを追跡できます。

```
https://example.com/lp.html?job=company_job1&utm_source=google&utm_medium=cpc&utm_campaign=spring2026
```

---

## パラメータ一覧

| パラメータ | 必須 | 説明 | 例 |
|-----------|:----:|------|-----|
| `utm_source` | ○ | 流入元（どこから来たか） | google, indeed, tiktok, line, instagram |
| `utm_medium` | ○ | メディア種別 | cpc, organic, social, email, referral |
| `utm_campaign` | ○ | キャンペーン名 | spring2026, manufacturing_nagoya |
| `utm_content` | △ | 広告クリエイティブ（A/Bテスト用） | banner_a, video_30sec |
| `utm_term` | △ | 検索キーワード | 製造+求人+愛知 |

---

## 命名規則

### utm_source（流入元）

| 値 | 使用場面 |
|----|----------|
| `google` | Google広告、Google検索 |
| `yahoo` | Yahoo!広告 |
| `indeed` | Indeed広告 |
| `tiktok` | TikTok広告 |
| `instagram` | Instagram広告 |
| `facebook` | Facebook広告 |
| `line` | LINE広告 |
| `twitter` | X(Twitter)広告 |
| `youtube` | YouTube広告 |
| `求人ボックス` | 求人ボックス |
| `スタンバイ` | スタンバイ |
| `newsletter` | メールマガジン |
| `qr` | QRコード（チラシ等） |

### utm_medium（メディア種別）

| 値 | 説明 |
|----|------|
| `cpc` | クリック課金広告（リスティング広告） |
| `display` | ディスプレイ広告（バナー広告） |
| `social` | SNS広告 |
| `video` | 動画広告 |
| `email` | メールマガジン |
| `referral` | 他サイトからのリンク |
| `organic` | 自然検索（広告費なし） |
| `qr` | QRコード |
| `affiliate` | アフィリエイト |

### utm_campaign（キャンペーン名）

**命名フォーマット**: `[時期]_[ターゲット]_[地域]`

```
例:
- spring2026_manufacturing_aichi
- 202602_logistics_osaka
- winter_newgrad_tokyo
```

**ルール:**
- 英数字とアンダースコアのみ使用
- 日本語は使わない（URLエンコードで長くなるため）
- 小文字で統一

### utm_content（クリエイティブ識別）

A/Bテストや複数クリエイティブを区別するために使用。

```
例:
- banner_a / banner_b
- video_15sec / video_30sec
- image_factory / image_office
- headline_salary / headline_benefits
```

### utm_term（検索キーワード）

Google広告などでキーワード自動挿入を使う場合：
```
utm_term={keyword}
```

手動設定の場合はプラス区切り：
```
utm_term=製造+求人+愛知
```

---

## 広告媒体別テンプレート

### Google広告（リスティング）

```
?utm_source=google&utm_medium=cpc&utm_campaign=[キャンペーン名]&utm_term={keyword}
```

### Google広告（ディスプレイ）

```
?utm_source=google&utm_medium=display&utm_campaign=[キャンペーン名]&utm_content=[バナー名]
```

### Indeed

```
?utm_source=indeed&utm_medium=cpc&utm_campaign=[キャンペーン名]
```

### TikTok広告

```
?utm_source=tiktok&utm_medium=social&utm_campaign=[キャンペーン名]&utm_content=[動画ID]
```

### Instagram広告

```
?utm_source=instagram&utm_medium=social&utm_campaign=[キャンペーン名]&utm_content=[クリエイティブ名]
```

### LINE広告

```
?utm_source=line&utm_medium=social&utm_campaign=[キャンペーン名]
```

### メールマガジン

```
?utm_source=newsletter&utm_medium=email&utm_campaign=[配信日or配信名]
```

### QRコード（チラシ・ポスター）

```
?utm_source=qr&utm_medium=qr&utm_campaign=[媒体名]_[設置場所]
```

例: `?utm_source=qr&utm_medium=qr&utm_campaign=flyer_nagoya_station`

---

## 完全なURL例

### 製造スタッフ求人 - Google広告

```
https://your-domain.web.app/lp.html?job=companyA_job001&utm_source=google&utm_medium=cpc&utm_campaign=202602_manufacturing_aichi&utm_term=製造+求人+愛知
```

### 物流スタッフ求人 - TikTok広告

```
https://your-domain.web.app/lp.html?job=companyB_job002&utm_source=tiktok&utm_medium=social&utm_campaign=202602_logistics_osaka&utm_content=video_30sec_warehouse
```

### 採用ページ - Instagram広告

```
https://your-domain.web.app/company-recruit.html?domain=companyC&utm_source=instagram&utm_medium=social&utm_campaign=brand_awareness_2026
```

---

## トラッキングデータの確認

応募データ（Firestore `applications` コレクション）に以下が保存されます：

| フィールド | 内容 |
|-----------|------|
| `utm_source` | 流入元 |
| `utm_medium` | メディア種別 |
| `utm_campaign` | キャンペーン名 |
| `utm_content` | クリエイティブ |
| `utm_term` | 検索キーワード |
| `landingPage` | 最初に見たページ |
| `lpDesignPattern` | LPのデザインパターン |
| `firstVisitAt` | 初回訪問日時 |
| `daysToConversion` | 初回訪問→応募までの日数 |

---

## 注意事項

1. **パラメータは必ず `?` の後に付ける**
   - 既に `?job=xxx` がある場合は `&` で繋ぐ
   ```
   ✓ lp.html?job=xxx&utm_source=google
   ✗ lp.html?job=xxx?utm_source=google
   ```

2. **日本語はURLエンコードされる**
   - `utm_term=製造 求人` → `utm_term=%E8%A3%BD%E9%80%A0%20%E6%B1%82%E4%BA%BA`
   - campaign名は英数字で統一推奨

3. **First-touch attribution**
   - 初回訪問時のUTMが応募に紐づく
   - 2回目以降の訪問でUTMが変わっても、初回のUTMが優先される

4. **テスト時の注意**
   - localStorage をクリアしないと前回のUTMが残る
   - シークレットモードでテスト推奨

---

## 管理画面での確認方法

（将来実装予定）

- 詳細分析 → 流入元分析
- チャネル別応募数
- キャンペーン別CVR

---

## 関連ファイル

| ファイル | 説明 |
|----------|------|
| [utm-tracking.js](https://github.com/togawa-design/togawa-design.github.io/blob/develop/src/shared/utm-tracking.js) | UTMトラッキング処理 |
| [lp.js](https://github.com/togawa-design/togawa-design.github.io/blob/develop/src/pages/lp.js) | LP応募処理 |
| [analytics-features-plan.md](../todo/analytics-features-plan.md) | 分析機能計画 |
