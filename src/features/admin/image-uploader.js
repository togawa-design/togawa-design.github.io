/**
 * 画像アップロード機能
 * - Cloudinaryへのアップロード（無料25GB）
 * - 画像圧縮・最適化
 */

// Cloudinary設定（unsigned upload preset使用）
const CLOUDINARY_CONFIG = {
  cloudName: 'dnvtqyhuw',  // Cloudinaryのクラウド名
  uploadPreset: 'rikueko_unsigned'  // Unsigned upload preset名
};

/**
 * 画像を圧縮・WebP変換する
 * @param {File} file - 元の画像ファイル
 * @param {Object} options - オプション
 * @returns {Promise<Blob>} - 圧縮された画像Blob
 */
export async function compressImage(file, options = {}) {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.8,
    outputType = 'image/webp'
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      // アスペクト比を維持してリサイズ
      let { width, height } = img;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      canvas.width = width;
      canvas.height = height;

      // 画像を描画
      ctx.drawImage(img, 0, 0, width, height);

      // Blobとして出力
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('画像の変換に失敗しました'));
          }
        },
        outputType,
        quality
      );
    };

    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * ロゴ用に画像を圧縮する（小さめ）
 */
export async function compressLogo(file) {
  return compressImage(file, {
    maxWidth: 400,
    maxHeight: 400,
    quality: 0.85,
    outputType: 'image/webp'
  });
}

/**
 * コンテンツ画像用に圧縮する
 */
export async function compressContentImage(file) {
  return compressImage(file, {
    maxWidth: 1200,
    maxHeight: 800,
    quality: 0.8,
    outputType: 'image/webp'
  });
}

/**
 * Cloudinaryに画像をアップロードする
 * @param {Blob|File} file - アップロードするファイル
 * @param {string} folder - フォルダパス
 * @param {string} publicId - 公開ID（オプション）
 * @returns {Promise<string>} - 画像URL
 */
export async function uploadToCloudinary(file, folder, publicId = null) {
  const { cloudName, uploadPreset } = CLOUDINARY_CONFIG;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', folder);

  if (publicId) {
    formData.append('public_id', publicId);
  }

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: 'POST',
      body: formData
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'アップロードに失敗しました');
  }

  const result = await response.json();
  return result.secure_url;
}

/**
 * 企業ロゴをアップロードする（会社情報用）
 * @param {File} file - 画像ファイル
 * @param {string} companyDomain - 企業ドメイン
 * @returns {Promise<string>} - 画像URL
 */
export async function uploadCompanyLogo(file, companyDomain) {
  // 圧縮
  const compressed = await compressLogo(file);

  // Cloudinaryにアップロード（タイムスタンプ付きでキャッシュ問題回避）
  const folder = `companies/${companyDomain}`;
  const timestamp = Date.now();
  const url = await uploadToCloudinary(compressed, folder, `logo_${timestamp}`);

  return url;
}

/**
 * 採用ページ用ロゴをアップロードする
 * @param {File} file - 画像ファイル
 * @param {string} companyDomain - 企業ドメイン
 * @returns {Promise<string>} - 画像URL
 */
export async function uploadRecruitLogo(file, companyDomain) {
  // 圧縮
  const compressed = await compressLogo(file);

  // Cloudinaryにアップロード（採用ページ専用パス）
  const folder = `recruit/${companyDomain}`;
  const url = await uploadToCloudinary(compressed, folder, 'logo');

  return url;
}

/**
 * 企業説明用の画像をアップロードする
 * @param {File} file - 画像ファイル
 * @param {string} companyDomain - 企業ドメイン
 * @returns {Promise<string>} - 画像URL
 */
export async function uploadCompanyImage(file, companyDomain) {
  // 圧縮
  const compressed = await compressContentImage(file);

  // Cloudinaryにアップロード
  const folder = `companies/${companyDomain}/images`;
  const url = await uploadToCloudinary(compressed, folder);

  return url;
}

/**
 * 求人用の画像をアップロードする
 * @param {File} file - 画像ファイル
 * @param {string} companyDomain - 企業ドメイン
 * @param {string} jobId - 求人ID
 * @returns {Promise<string>} - 画像URL
 */
export async function uploadJobImage(file, companyDomain, jobId) {
  // 圧縮
  const compressed = await compressContentImage(file);

  // Cloudinaryにアップロード
  const folder = `jobs/${companyDomain}/${jobId}`;
  const url = await uploadToCloudinary(compressed, folder);

  return url;
}

/**
 * LP用の画像をアップロードする
 * @param {File} file - 画像ファイル
 * @param {string} companyDomain - 企業ドメイン
 * @returns {Promise<string>} - 画像URL
 */
export async function uploadLPImage(file, companyDomain) {
  // 圧縮
  const compressed = await compressContentImage(file);

  // Cloudinaryにアップロード
  const folder = `lp/${companyDomain}`;
  const url = await uploadToCloudinary(compressed, folder);

  return url;
}

/**
 * ファイル選択ダイアログを表示して画像を選択する
 * @param {Object} options - オプション
 * @returns {Promise<File>} - 選択されたファイル
 */
export function selectImageFile(options = {}) {
  const { accept = 'image/*', multiple = false } = options;

  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;

    input.onchange = (e) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        resolve(multiple ? Array.from(files) : files[0]);
      } else {
        reject(new Error('ファイルが選択されませんでした'));
      }
    };

    input.click();
  });
}

/**
 * ドラッグ&ドロップエリアを設定する
 * @param {HTMLElement} element - ドロップエリア要素
 * @param {Function} onDrop - ドロップ時のコールバック
 */
export function setupDropZone(element, onDrop) {
  element.addEventListener('dragover', (e) => {
    e.preventDefault();
    element.classList.add('drag-over');
  });

  element.addEventListener('dragleave', (e) => {
    e.preventDefault();
    element.classList.remove('drag-over');
  });

  element.addEventListener('drop', async (e) => {
    e.preventDefault();
    element.classList.remove('drag-over');

    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith('image/')
    );

    if (files.length > 0) {
      onDrop(files);
    }
  });
}

/**
 * 画像プレビューを表示する
 * @param {File|Blob} file - 画像ファイル
 * @param {HTMLElement} container - プレビュー表示先
 */
export function showImagePreview(file, container) {
  const reader = new FileReader();
  reader.onload = (e) => {
    container.innerHTML = `<img src="${e.target.result}" alt="プレビュー" style="max-width: 100%; max-height: 200px; object-fit: contain;">`;
  };
  reader.readAsDataURL(file);
}

/**
 * 画像アップロードUIコンポーネントを生成する
 * @param {Object} options - オプション
 * @returns {HTMLElement} - UIコンポーネント
 */
export function createImageUploader(options = {}) {
  const {
    id = 'image-uploader',
    label = '画像をアップロード',
    currentUrl = '',
    onUpload = () => {},
    uploadFn = null // アップロード関数
  } = options;

  const container = document.createElement('div');
  container.className = 'image-uploader';
  container.id = id;

  container.innerHTML = `
    <label class="image-uploader-label">${label}</label>
    <div class="image-uploader-area" data-drop-zone>
      ${currentUrl
        ? `<img src="${currentUrl}" alt="現在の画像" class="image-uploader-preview">`
        : `<div class="image-uploader-placeholder">
            <span class="upload-icon">📷</span>
            <p>クリックまたはドラッグ&ドロップ</p>
            <p class="upload-hint">PNG, JPG, WebP (最大5MB)</p>
          </div>`
      }
      <input type="file" accept="image/*" class="image-uploader-input" style="display: none;">
      <div class="image-uploader-loading" style="display: none;">
        <div class="loading-spinner"></div>
        <p>アップロード中...</p>
      </div>
    </div>
    <input type="hidden" class="image-uploader-url" value="${currentUrl}">
  `;

  const area = container.querySelector('[data-drop-zone]');
  const input = container.querySelector('.image-uploader-input');
  const loading = container.querySelector('.image-uploader-loading');
  const urlInput = container.querySelector('.image-uploader-url');

  // クリックでファイル選択
  area.addEventListener('click', () => {
    if (!loading.style.display || loading.style.display === 'none') {
      input.click();
    }
  });

  // ファイル選択時
  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    await handleUpload(file);
  });

  // ドラッグ&ドロップ
  setupDropZone(area, async (files) => {
    if (files.length > 0) {
      await handleUpload(files[0]);
    }
  });

  // アップロード処理
  async function handleUpload(file) {
    if (!uploadFn) {
      console.error('[ImageUploader] uploadFn is required');
      return;
    }

    loading.style.display = 'flex';

    try {
      const url = await uploadFn(file);
      urlInput.value = url;

      // プレビュー更新
      area.innerHTML = `
        <img src="${url}" alt="アップロード済み" class="image-uploader-preview">
        <div class="image-uploader-loading" style="display: none;">
          <div class="loading-spinner"></div>
          <p>アップロード中...</p>
        </div>
      `;

      onUpload(url);
    } catch (error) {
      console.error('[ImageUploader] Upload failed:', error);
      alert('画像のアップロードに失敗しました: ' + error.message);
    } finally {
      loading.style.display = 'none';
    }
  }

  // 現在のURLを取得するメソッド
  container.getUrl = () => urlInput.value;
  container.setUrl = (url) => {
    urlInput.value = url;
    if (url) {
      area.innerHTML = `
        <img src="${url}" alt="現在の画像" class="image-uploader-preview">
        <div class="image-uploader-loading" style="display: none;">
          <div class="loading-spinner"></div>
          <p>アップロード中...</p>
        </div>
      `;
    }
  };

  return container;
}

export default {
  compressImage,
  compressLogo,
  compressContentImage,
  uploadToCloudinary,
  uploadCompanyLogo,
  uploadRecruitLogo,
  uploadCompanyImage,
  uploadJobImage,
  uploadLPImage,
  selectImageFile,
  setupDropZone,
  showImagePreview,
  createImageUploader
};
