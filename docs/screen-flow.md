# リクエコ求人ナビ 画面遷移図

## 全体遷移図（Mermaid形式）

```mermaid
flowchart TB
    subgraph Public["公開画面（求職者向け）"]
        TOP[トップページ<br/>index.html]
        JOBS[求人一覧<br/>jobs.html]
        DETAIL[求人詳細<br/>job-detail.html]
        COMPANY[企業ページ<br/>company.html]
        LOCATION[地域検索<br/>location.html]
        LP[企業LP<br/>lp.html]
        MYPAGE[マイページ<br/>mypage.html]
    end

    subgraph Admin["管理画面（企業向け）"]
        ADMIN[管理ダッシュボード<br/>admin.html]
        JOBMNG[求人管理<br/>job-manage.html]
        APPLICANTS[応募者管理<br/>applicants.html]
        COMEDIT[企業情報編集<br/>company-edit.html]
    end

    subgraph Modal["モーダル"]
        APPLY[応募フォーム]
        LOGIN[ログイン]
        JOBEDIT[求人編集]
        APPDETAIL[応募者詳細]
    end

    %% 公開画面の遷移
    TOP --> JOBS
    TOP --> DETAIL
    TOP --> COMPANY
    TOP --> LOCATION
    TOP --> LP
    TOP --> MYPAGE

    JOBS --> DETAIL
    JOBS --> LOCATION

    DETAIL --> COMPANY
    DETAIL --> APPLY
    DETAIL --> JOBS

    COMPANY --> DETAIL
    COMPANY --> APPLY

    LOCATION --> JOBS
    LOCATION --> DETAIL

    LP --> APPLY
    LP --> DETAIL

    MYPAGE --> DETAIL
    MYPAGE --> LOGIN

    %% 管理画面の遷移
    ADMIN --> JOBMNG
    ADMIN --> APPLICANTS
    ADMIN --> COMEDIT
    ADMIN --> LOGIN

    JOBMNG --> JOBEDIT
    JOBMNG --> APPDETAIL
    JOBMNG --> ADMIN

    APPLICANTS --> APPDETAIL
    APPLICANTS --> ADMIN

    COMEDIT --> ADMIN

    %% クロス遷移
    TOP -.-> ADMIN
    MYPAGE -.-> ADMIN
```

---

## 画面遷移マトリクス

### 公開画面間の遷移

| 遷移元 → | TOP | JOBS | DETAIL | COMPANY | LOCATION | LP | MYPAGE |
|----------|-----|------|--------|---------|----------|----|----|
| **TOP** | - | ○ | ○ | ○ | ○ | ○ | ○ |
| **JOBS** | ○ | - | ○ | - | ○ | - | ○ |
| **DETAIL** | ○ | ○ | - | ○ | - | - | ○ |
| **COMPANY** | ○ | - | ○ | - | - | - | ○ |
| **LOCATION** | ○ | ○ | ○ | - | - | - | ○ |
| **LP** | - | - | ○ | - | - | - | - |
| **MYPAGE** | ○ | - | ○ | - | - | - | - |

### 管理画面間の遷移

| 遷移元 → | ADMIN | JOBMNG | APPLICANTS | COMEDIT |
|----------|-------|--------|------------|---------|
| **ADMIN** | - | ○ | ○ | ○ |
| **JOBMNG** | ○ | - | ○ | - |
| **APPLICANTS** | ○ | - | - | - |
| **COMEDIT** | ○ | - | - | - |

---

## 詳細遷移フロー

### 1. 求人検索〜応募フロー

```mermaid
flowchart LR
    A[トップページ] --> B{検索方法}
    B -->|地域| C[地域検索]
    B -->|メーカー| D[求人一覧]
    B -->|直接| E[求人詳細]

    C --> D
    D --> E
    E --> F[応募モーダル]
    F --> G[応募完了]
    G --> H[マイページ]
```

**遷移詳細**:
1. トップページで検索方法を選択
2. 地域/メーカー/入社日で絞り込み
3. 求人カードをクリックして詳細へ
4. 「応募する」ボタンで応募モーダル表示
5. フォーム入力・送信
6. 完了画面表示
7. マイページで応募履歴確認

---

### 2. ユーザー認証フロー

```mermaid
flowchart TB
    A[任意の画面] --> B{ログイン状態}
    B -->|未ログイン| C[ログインモーダル]
    B -->|ログイン済| D[マイページ]

    C --> E{認証方法}
    E -->|メール| F[メール認証]
    E -->|Google| G[Google認証]

    F --> H{結果}
    G --> H

    H -->|成功| D
    H -->|失敗| C

    D --> I[応募履歴]
    D --> J[プロフィール編集]
    D --> K[ログアウト]
    K --> A
```

---

### 3. 管理画面フロー

```mermaid
flowchart TB
    A[ログイン] --> B[管理ダッシュボード]
    B --> C{企業選択}

    C --> D[求人管理]
    C --> E[応募者管理]
    C --> F[企業情報編集]

    subgraph 求人管理
        D --> D1[求人一覧]
        D1 --> D2[求人編集モーダル]
        D1 --> D3[CSVインポート]
        D --> D4[アクセス解析]
        D --> D5[応募者管理]
        D5 --> D6[応募者詳細]
        D --> D7[レポート生成]
        D7 --> D8[CSV/Excelダウンロード]
    end

    subgraph 応募者管理
        E --> E1[応募者一覧]
        E1 --> E2[応募者詳細]
        E2 --> E3[ステータス更新]
    end

    subgraph 企業情報編集
        F --> F1[基本情報]
        F --> F2[LP設定]
        F --> F3[フォーム設定]
        F --> F4[デザイン選択]
    end
```

---

### 4. 企業LP経由の応募フロー

```mermaid
flowchart LR
    A[外部流入<br/>広告/SNS] --> B[企業LP]
    B --> C{アクション}
    C -->|応募| D[応募モーダル]
    C -->|求人詳細| E[求人詳細]
    E --> D
    D --> F[応募完了]
    F --> G[サンクスページ]
```

---

## URL パラメータ一覧

| 画面 | パラメータ | 説明 | 例 |
|------|-----------|------|-----|
| job-detail.html | company | 企業ドメイン | toyota |
| job-detail.html | job | 求人ID | 1 |
| company.html | id | 企業ドメイン | toyota |
| location.html | pref | 都道府県 | 愛知県 |
| jobs.html | tag | 検索タグ | 寮完備 |
| jobs.html | maker | メーカー絞り込み | トヨタ |
| lp.html | id | 企業ドメイン | toyota |
| job-manage.html | company | 企業ドメイン | toyota |
| company-edit.html | id | 企業ドメイン | toyota |

---

## 状態遷移（ステートマシン）

### 応募ステータス

```mermaid
stateDiagram-v2
    [*] --> 新規: 応募受付
    新規 --> 連絡済: 電話/メール
    連絡済 --> 面接調整中: 面接日程調整
    面接調整中 --> 面接済: 面接実施
    面接済 --> 採用: 内定承諾
    面接済 --> 不採用: 不合格
    連絡済 --> 辞退: 応募者辞退
    面接調整中 --> 辞退: 応募者辞退
    採用 --> [*]
    不採用 --> [*]
    辞退 --> [*]
```

### ユーザー認証状態

```mermaid
stateDiagram-v2
    [*] --> 未認証
    未認証 --> 認証中: ログイン開始
    認証中 --> 認証済: 認証成功
    認証中 --> 未認証: 認証失敗
    認証済 --> 未認証: ログアウト
    認証済 --> セッション切れ: トークン期限切れ
    セッション切れ --> 未認証: 自動ログアウト
    セッション切れ --> 認証済: トークン更新
```

---

## 共通ヘッダーからの遷移

```
┌─────────────────────────────────────────────────────────┐
│ [ロゴ]  求人検索  企業一覧  期間工ガイド  [LINE相談] [ログイン] │
│    ↓       ↓        ↓          ↓           ↓         ↓     │
│   TOP    JOBS    (TOP)      (外部)       LINE    LOGIN/  │
│                                                   MYPAGE  │
└─────────────────────────────────────────────────────────┘
```

---

## エラー・例外遷移

| エラー種別 | 発生画面 | 遷移先 | 処理 |
|-----------|----------|--------|------|
| 404 Not Found | 任意 | エラーページ | トップへのリンク表示 |
| 認証エラー | 管理画面 | ログインモーダル | 再ログイン促す |
| データ読込エラー | 任意 | 同画面 | エラーメッセージ表示・リトライボタン |
| 応募送信エラー | 応募モーダル | 同モーダル | エラーメッセージ表示・再送信可能 |
| 権限エラー | 管理画面 | 管理ダッシュボード | 権限なしメッセージ表示 |

---

*最終更新: 2026-01-26*
