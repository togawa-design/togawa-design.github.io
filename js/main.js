// 期間工求人ナビ - メインJavaScript

document.addEventListener('DOMContentLoaded', function() {
  // 検索カードのタブ切り替え
  initSearchTabs();

  // モバイルメニュー
  initMobileMenu();

  // スムーススクロール
  initSmoothScroll();

  // スクロール時のヘッダー効果
  initHeaderScroll();
});

// 検索タブ機能
function initSearchTabs() {
  const searchCards = document.querySelectorAll('.search-card');
  const searchPanels = document.querySelectorAll('.search-panel');

  searchCards.forEach(card => {
    card.addEventListener('click', function() {
      const method = this.dataset.method;

      // すべてのカードとパネルからactiveを削除
      searchCards.forEach(c => c.classList.remove('active'));
      searchPanels.forEach(p => p.classList.remove('active'));

      // クリックされたカードをactive
      this.classList.add('active');

      // 対応するパネルを表示
      const panel = document.getElementById('panel-' + method);
      if (panel) {
        panel.classList.add('active');
      }

      // 相談の場合はモーダル表示（簡易実装）
      if (method === 'consult') {
        showConsultModal();
      }
    });
  });
}

// 相談モーダル（簡易版）
function showConsultModal() {
  const existingModal = document.querySelector('.consult-modal');
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement('div');
  modal.className = 'consult-modal';
  modal.innerHTML = `
    <div class="consult-modal-overlay"></div>
    <div class="consult-modal-content">
      <button class="consult-modal-close">&times;</button>
      <h3>無料相談</h3>
      <p>専門スタッフがあなたにぴったりの求人をご提案します</p>
      <div class="consult-options">
        <a href="#" class="consult-option line">
          <span class="icon">LINE</span>
          <span>LINEで相談</span>
        </a>
        <a href="#" class="consult-option tel">
          <span class="icon">TEL</span>
          <span>電話で相談</span>
        </a>
        <a href="#" class="consult-option form">
          <span class="icon">FORM</span>
          <span>フォームで相談</span>
        </a>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // スタイルを追加
  addModalStyles();

  // アニメーション用に少し遅延
  requestAnimationFrame(() => {
    modal.classList.add('active');
  });

  // 閉じる機能
  modal.querySelector('.consult-modal-close').addEventListener('click', () => {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 300);
  });

  modal.querySelector('.consult-modal-overlay').addEventListener('click', () => {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 300);
  });
}

// モーダルスタイルを動的追加
function addModalStyles() {
  if (document.getElementById('modal-styles')) return;

  const style = document.createElement('style');
  style.id = 'modal-styles';
  style.textContent = `
    .consult-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s;
    }
    .consult-modal.active {
      opacity: 1;
    }
    .consult-modal-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
    }
    .consult-modal-content {
      position: relative;
      background: #fff;
      padding: 40px;
      border-radius: 16px;
      max-width: 500px;
      width: 90%;
      text-align: center;
      transform: translateY(20px);
      transition: transform 0.3s;
    }
    .consult-modal.active .consult-modal-content {
      transform: translateY(0);
    }
    .consult-modal-close {
      position: absolute;
      top: 15px;
      right: 15px;
      background: none;
      border: none;
      font-size: 28px;
      cursor: pointer;
      color: #666;
    }
    .consult-modal-content h3 {
      font-size: 24px;
      margin-bottom: 10px;
    }
    .consult-modal-content p {
      color: #666;
      margin-bottom: 25px;
    }
    .consult-options {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .consult-option {
      display: flex;
      align-items: center;
      gap: 15px;
      padding: 15px 20px;
      border-radius: 10px;
      font-weight: 600;
      transition: all 0.3s;
    }
    .consult-option .icon {
      width: 50px;
      height: 50px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 14px;
      color: #fff;
    }
    .consult-option.line {
      background: #e8f5e9;
    }
    .consult-option.line .icon {
      background: #06c755;
    }
    .consult-option.line:hover {
      background: #c8e6c9;
    }
    .consult-option.tel {
      background: #e3f2fd;
    }
    .consult-option.tel .icon {
      background: #2196f3;
    }
    .consult-option.tel:hover {
      background: #bbdefb;
    }
    .consult-option.form {
      background: #fff3e0;
    }
    .consult-option.form .icon {
      background: #ff9800;
    }
    .consult-option.form:hover {
      background: #ffe0b2;
    }
  `;
  document.head.appendChild(style);
}

// モバイルメニュー
function initMobileMenu() {
  const menuBtn = document.querySelector('.mobile-menu-btn');
  if (!menuBtn) return;

  // モバイルナビを作成
  const mobileNav = document.createElement('nav');
  mobileNav.className = 'mobile-nav';
  mobileNav.innerHTML = `
    <ul>
      <li><a href="#jobs">お仕事紹介</a></li>
      <li><a href="#content">コンテンツ</a></li>
      <li><a href="#about">当サイトについて</a></li>
      <li><a href="#contact">お問い合わせ</a></li>
      <li><a href="#login">ログイン</a></li>
    </ul>
  `;
  document.querySelector('.header').after(mobileNav);

  menuBtn.addEventListener('click', function() {
    this.classList.toggle('active');
    mobileNav.classList.toggle('active');

    // ハンバーガーアニメーション
    const spans = this.querySelectorAll('span');
    if (this.classList.contains('active')) {
      spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
      spans[1].style.opacity = '0';
      spans[2].style.transform = 'rotate(-45deg) translate(7px, -6px)';
    } else {
      spans[0].style.transform = '';
      spans[1].style.opacity = '';
      spans[2].style.transform = '';
    }
  });

  // リンククリックでメニューを閉じる
  mobileNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      menuBtn.classList.remove('active');
      mobileNav.classList.remove('active');
      const spans = menuBtn.querySelectorAll('span');
      spans[0].style.transform = '';
      spans[1].style.opacity = '';
      spans[2].style.transform = '';
    });
  });
}

// スムーススクロール
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#') return;

      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const headerHeight = document.querySelector('.header').offsetHeight;
        const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight;

        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
}

// スクロール時のヘッダー効果
function initHeaderScroll() {
  const header = document.querySelector('.header');
  let lastScrollY = 0;

  window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;

    if (currentScrollY > 100) {
      header.style.boxShadow = '0 2px 20px rgba(0,0,0,0.15)';
    } else {
      header.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
    }

    lastScrollY = currentScrollY;
  });
}

// 求人カードのホバーエフェクト強化
document.querySelectorAll('.job-card').forEach(card => {
  card.addEventListener('mouseenter', function() {
    this.style.transform = 'translateY(-8px)';
  });

  card.addEventListener('mouseleave', function() {
    this.style.transform = '';
  });
});

// 数字のカウントアップアニメーション
function animateNumbers() {
  const statNumbers = document.querySelectorAll('.stat-number');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const target = entry.target;
        const finalNumber = parseInt(target.textContent.replace(/,/g, ''));
        animateNumber(target, finalNumber);
        observer.unobserve(target);
      }
    });
  }, { threshold: 0.5 });

  statNumbers.forEach(num => observer.observe(num));
}

function animateNumber(element, target) {
  const duration = 2000;
  const start = 0;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(start + (target - start) * easeProgress);

    element.textContent = current.toLocaleString();

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

// ページ読み込み完了時にアニメーション開始
window.addEventListener('load', animateNumbers);
