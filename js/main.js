// リクエコ求人ナビ - メインJavaScript

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

      // 相談の場合はモーダル表示
      if (method === 'consult') {
        showConsultModal();
      }
    });
  });
}

// 相談モーダル
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
      <li><a href="admin.html">管理者</a></li>
    </ul>
  `;
  document.querySelector('.header').after(mobileNav);

  menuBtn.addEventListener('click', function() {
    this.classList.toggle('active');
    mobileNav.classList.toggle('active');
  });

  // リンククリックでメニューを閉じる
  mobileNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      menuBtn.classList.remove('active');
      mobileNav.classList.remove('active');
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

  window.addEventListener('scroll', () => {
    if (window.scrollY > 100) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });
}

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
