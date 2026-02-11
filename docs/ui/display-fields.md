# 採用ページ・LP 表示項目一覧

## 採用ページ（company-recruit.html）

### 求人カード表示項目

| フィールド名 | 表示ラベル | 備考 |
|---|---|---|
| `jobLogo` / `imageUrl` | 求人画像 | カード背景画像 |
| `title` | 求人タイトル | - |
| `location` / `companyAddress` | 勤務地 | 📍アイコン |
| `access` | アクセス | 🚌アイコン |
| `monthlySalary` | 月収例 | 💰アイコン |
| `totalBonus` | 特典総額 | 黄色ハイライト表示 |
| `features` / `displayedFeatures` | 特徴タグ | 最大 **3つ** まで表示 |
| `jobType` | 職種 | フィルタリング用（`data-job-type`属性） |
| `publishStartDate` | - | 1週間以内なら「✨ NEW」タグ表示 |

---

## LP（lp.html）

### 求人カード表示項目

| フィールド名 | 表示ラベル | 備考 |
|---|---|---|
| `title` | 求人タイトル | カードヘッダー |
| `employmentType` | 雇用形態 | バッジ表示（例：正社員） |
| `location` | 勤務地 | 📍アイコン |
| `access` | アクセス | 🚌アイコン |
| `monthlySalary` | 月収例 | 💰アイコン |
| `totalBonus` | 特典総額 | ハイライト表示 |
| `features` / `displayedFeatures` | 特徴タグ | 最大 **5つ** まで表示 |
| `publishStartDate` | - | 1週間以内なら「✨ NEW」タグ表示 |

### 募集要項セクション（DetailsSection）

| フィールド名 | 表示ラベル | データソース |
|---|---|---|
| `description` | 会社概要 | 会社データ |
| `jobDescription` | お仕事内容 | 会社データ |
| `workingHours` | 勤務時間 | 会社データ / 求人データ |
| `workLocation` | 勤務地 | 会社データ |
| `benefits` | 待遇・福利厚生 | 求人データ / 会社データ |
| `requirements` | 応募資格 | 求人データ |
| `holidays` | 休日 | 求人データ |

---

## 比較表

| 項目 | 採用ページ | LP |
|---|:---:|:---:|
| **雇用形態** (`employmentType`) | ❌ | ✅ バッジ表示 |
| **職種** (`jobType`) | フィルタのみ | ❌ |
| **特徴タグ数** | 最大3つ | 最大5つ |
| **募集要項詳細** | ❌ | ✅ |
| **NEWタグ** | ✅ | ✅ |

---

## 管理画面での入力項目

### 基本情報
- `title` - 募集タイトル（必須）
- `employmentType` - 雇用形態
- `jobType` - 職種
- `location` - 勤務地（必須）
- `access` - アクセス
- `jobLogo` - 求人ロゴ画像

### 給与・条件
- `salaryType` - 給与形態
- `monthlySalary` - 給与額
- `totalBonus` - 賞与合計

### 勤務情報
- `workingHours` - 勤務時間
- `holidays` - 休日

### 詳細情報
- `jobDescription` - 仕事内容
- `requirements` - 応募資格
- `benefits` - 待遇・福利厚生
- `features` - 特徴（チェックボックス選択）
- `displayedFeatures` - 表示する特徴（最大5つ）

### 掲載設定
- `visible` - 公開/非公開
- `publishStartDate` - 掲載開始日
- `publishEndDate` - 掲載終了日
- `order` - 表示順
- `memo` - 社内用メモ

---

## 補足

### 特徴タグについて
- `features`: 求人に設定された全特徴（カンマ区切り）
- `displayedFeatures`: 実際に表示する特徴（カンマ区切り、最大5つ）
- 採用ページでは `displayedFeatures` から最大3つを表示
- LPでは `displayedFeatures` から最大5つを表示

### NEWタグの表示条件
- `publishStartDate` が現在から1週間以内の場合に「✨ NEW」タグを表示

### デザインパターン（LP）
LPでは以下のデザインパターンに対応：
- `standard` - 標準
- `yellow` - 黄色
- `impact` - インパクト
- `trust` - 信頼
- `athome` - アットホーム
- `regional` - 地域密着
