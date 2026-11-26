/* ==========================================================================
   Shopify OS 2.0 Native Bundle Builder & Slide-Out Cart Drawer (MIT)
   Pure Vanilla ES6 · Zero jQuery · Zero third-party frameworks
   ========================================================================== */
(() => {
  if (window.__CK_BUNDLE_DRAWER_INIT__) return;
  window.__CK_BUNDLE_DRAWER_INIT__ = true;

  const formatMoney = (cents, symbol = '$') =>
    symbol + (Number(cents || 0) / 100).toFixed(2);

  const openDrawer = (id = 'CodeKitCartDrawer') => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('is-open');
    el.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };

  const closeDrawers = () => {
    document.querySelectorAll('.ck-drawer.is-open').forEach((el) => {
      el.classList.remove('is-open');
      el.setAttribute('aria-hidden', 'true');
    });
    document.body.style.overflow = '';
  };

  const showToast = (msg) => {
    const toast = document.getElementById('CodeKitToast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('is-visible');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
  };

  const refreshCartUI = async () => {
    const drawer = document.querySelector('[data-ck-cart-drawer]');
    if (!drawer) return;
    const sym = drawer.getAttribute('data-currency-symbol') || '$';
    const threshold = Number(drawer.getAttribute('data-ship-threshold-cents') || 0);

    const res = await fetch('/cart.js', { headers: { Accept: 'application/json' } });
    if (!res.ok) return;
    const cart = await res.json();

    document.querySelectorAll('[data-ck-cart-count]').forEach((el) => {
      el.textContent = String(cart.item_count);
    });

    const subtotalEl = drawer.querySelector('[data-ck-cart-subtotal]');
    if (subtotalEl) subtotalEl.textContent = formatMoney(cart.total_price, sym);

    const itemsWrap = drawer.querySelector('[data-ck-cart-items]');
    if (itemsWrap) {
      itemsWrap.textContent = '';
      if (!cart.items || cart.items.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'ck-muted';
        empty.textContent = 'Your cart is currently empty.';
        itemsWrap.appendChild(empty);
      } else {
        cart.items.forEach((item) => {
          const row = document.createElement('div');
          row.className = 'ck-cart-item';

          const info = document.createElement('div');
          const title = document.createElement('strong');
          title.textContent = item.product_title || item.title;
          const meta = document.createElement('p');
          meta.className = 'ck-muted';
          const variantLabel = item.variant_title ? `${item.variant_title} · ` : '';
          meta.textContent = `${variantLabel}${formatMoney(item.final_line_price, sym)}`;
          info.append(title, meta);

          const qty = document.createElement('span');
          qty.className = 'ck-mono';
          qty.textContent = `x${item.quantity}`;

          row.append(info, qty);
          itemsWrap.appendChild(row);
        });
      }
    }

    if (threshold > 0) {
      const pct = Math.min(100, Math.round((cart.total_price / threshold) * 100));
      const fill = drawer.querySelector('[data-ck-ship-fill]');
      const text = drawer.querySelector('[data-ck-ship-text]');
      if (fill) fill.style.width = `${pct}%`;
      if (text) {
        const remaining = threshold - cart.total_price;
        text.textContent =
          remaining <= 0
            ? 'Complimentary express shipping unlocked!'
            : `Add ${formatMoney(remaining, sym)} more for free shipping`;
      }
    }
  };

  // Delegated click handler (open/close drawer + 1-click upsell add)
  document.addEventListener('click', async (e) => {
    const opener = e.target.closest('[data-ck-open]');
    if (opener) {
      e.preventDefault();
      await refreshCartUI().catch(() => {});
      openDrawer(opener.getAttribute('data-ck-open'));
      return;
    }

    if (e.target.closest('[data-ck-close]')) {
      closeDrawers();
      return;
    }

    const addBtn = e.target.closest('[data-ck-add]');
    if (addBtn) {
      const id = Number(addBtn.getAttribute('data-ck-add'));
      if (!id) return;
      addBtn.disabled = true;
      try {
        const res = await fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: [{ id, quantity: 1 }] })
        });
        if (!res.ok) throw new Error('Cart add failed');
        await refreshCartUI();
        openDrawer('CodeKitCartDrawer');
        showToast('Added to bag');
      } catch (_) {
        showToast('Unable to add item');
      } finally {
        addBtn.disabled = false;
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawers();
  });

  // 1-Click Multi-Item Bundle Builder
  document.querySelectorAll('[data-ck-bundle]').forEach((box) => {
    const pct = Number(box.getAttribute('data-discount-pct') || 15);
    const sym = box.getAttribute('data-currency-symbol') || '$';
    const totalEl = box.querySelector('[data-ck-bundle-total]');

    const updateTotal = () => {
      let cents = 0;
      box.querySelectorAll('[data-ck-bundle-check]:checked').forEach((chk) => {
        cents += Number(chk.getAttribute('data-price') || 0);
      });
      const discountedCents = Math.round((cents * (100 - pct)) / 100);
      if (totalEl) totalEl.textContent = formatMoney(discountedCents, sym);
    };

    box.addEventListener('change', updateTotal);
    updateTotal();

    const submit = box.querySelector('[data-ck-bundle-submit]');
    if (submit) {
      submit.addEventListener('click', async () => {
        const items = [];
        box.querySelectorAll('[data-ck-bundle-check]:checked').forEach((chk) => {
          const vid = Number(chk.getAttribute('data-variant-id'));
          if (vid) items.push({ id: vid, quantity: 1 });
        });
        if (!items.length) {
          showToast('Assign real Shopify products in Theme Editor first');
          return;
        }
        submit.disabled = true;
        try {
          const res = await fetch('/cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
          });
          if (!res.ok) throw new Error('Bundle add failed');
          await refreshCartUI();
          openDrawer('CodeKitCartDrawer');
          showToast(`Bundle (${items.length} items) added to bag`);
        } catch (_) {
          showToast('Unable to add bundle');
        } finally {
          submit.disabled = false;
        }
      });
    }
  });
})();
