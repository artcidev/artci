(() => {
  const tabs = Array.from(document.querySelectorAll('.tab'));
  const panel = document.getElementById('panel-main');
  const operator = document.getElementById('operator');
  const form = document.getElementById('feedbackForm');
  const sendButton = document.getElementById('sendButton');
  const successDialog = document.getElementById('successDialog');
  const closeDialogBtn = document.getElementById('closeDialog');
  // Feature detection: CSS mask support
  try {
    const supportsMask = (typeof CSS !== 'undefined' && CSS.supports && (CSS.supports('mask-image', 'none') || CSS.supports('-webkit-mask-image', 'none')));
    if (!supportsMask) {
      document.documentElement.classList.add('no-mask');
    }
  } catch (_) {
    document.documentElement.classList.add('no-mask');
  }

  // Helpers
  function getSelectedRatings() {
    const groups = Array.from(form.querySelectorAll('.rating-options'));
    const result = {};
    groups.forEach(g => {
      const name = g.dataset.group;
      const checked = g.querySelector('input[type="radio"]:checked');
      if (checked) {
        result[name] = checked.value;
      }
    });
    return result;
  }

  function isFormReady() {
    const operatorChosen = !!operator.value;
    const ratings = getSelectedRatings();
    const atLeastOneRating = Object.keys(ratings).length > 0;
    return operatorChosen && atLeastOneRating;
  }

  function updateSendState() {
    sendButton.disabled = !isFormReady();
  }

  // Tabs interaction
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const current = document.querySelector('.tab.is-active');
      if (current) {
        current.classList.remove('is-active');
        current.setAttribute('aria-selected', 'false');
      }
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');
      panel.setAttribute('aria-labelledby', tab.id);
      // Optionally, switch content per tab here if needed.
    });
  });

  // Form interactions
  operator.addEventListener('change', updateSendState);

  // Custom dropdown (operator) behavior
  const selectWrap = document.querySelector('.select-wrap[data-target="operator"]');
  let activeIndex = -1;
  function initCustomSelect() {
    if (!selectWrap) return;
    const native = operator; // hidden select
    const trigger = selectWrap.querySelector('.select-trigger');
    const list = selectWrap.querySelector('.select-list');
    const labelEl = trigger.querySelector('.select-label');
    const options = Array.from(selectWrap.querySelectorAll('.select-option'));
    const operatorLabel = document.querySelector('label[for="operator"]');

    // Make options focusable for keyboard nav
    options.forEach((opt) => opt.setAttribute('tabindex', '-1'));

    function setSelectedByValue(value) {
      options.forEach((opt, i) => {
        const isSel = opt.dataset.value === value;
        opt.setAttribute('aria-selected', isSel ? 'true' : 'false');
        if (isSel) activeIndex = i;
      });
    }

    function setValue(value, text) {
      native.value = value;
      labelEl.textContent = text;
      setSelectedByValue(value);
      native.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function openList() {
      trigger.setAttribute('aria-expanded', 'true');
      list.hidden = false;
      // focus current or first
      const target = options[Math.max(activeIndex, 0)] || options[0];
      if (target) target.focus();
    }

    function closeList() {
      trigger.setAttribute('aria-expanded', 'false');
      list.hidden = true;
    }

    function toggleList() {
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      expanded ? closeList() : openList();
    }

    function onOptionClick(e) {
      const opt = e.currentTarget;
      const val = opt.dataset.value;
      const txt = opt.querySelector('.opt-text')?.textContent?.trim() || '';
      setValue(val, txt);
      closeList();
      trigger.focus();
    }

    function onTriggerKey(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleList();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        openList();
      }
    }

    function onListKey(e) {
      const max = options.length - 1;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(max, activeIndex + 1);
        options[activeIndex]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(0, activeIndex - 1);
        options[activeIndex]?.focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        activeIndex = 0; options[0]?.focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        activeIndex = max; options[max]?.focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeList(); trigger.focus();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const opt = options[activeIndex];
        if (opt) onOptionClick({ currentTarget: opt });
      }
    }

    // Click outside
    function onDocClick(e) {
      if (!selectWrap.contains(e.target)) {
        closeList();
      }
    }

    // Events
    trigger.addEventListener('click', toggleList);
    trigger.addEventListener('keydown', onTriggerKey);
    list.addEventListener('keydown', onListKey);
    options.forEach((opt, i) => {
      opt.addEventListener('click', onOptionClick);
      opt.addEventListener('focus', () => { activeIndex = i; });
    });
    document.addEventListener('click', onDocClick);

    // Label clicks move focus to trigger and label association for SR
    if (operatorLabel) {
      if (!operatorLabel.id) operatorLabel.id = 'operator-label';
      trigger.setAttribute('aria-labelledby', operatorLabel.id);
      operatorLabel.addEventListener('click', (e) => {
        e.preventDefault();
        trigger.focus();
      });
    }

    // Init from native select if preselected
    const pre = native.value;
    if (pre) {
      const found = options.find(o => o.dataset.value === pre);
      if (found) setValue(pre, found.querySelector('.opt-text').textContent.trim());
    }

    // Expose reset for dialog close handler
    function resetCustomSelect() {
      labelEl.textContent = 'Select an operator';
      setSelectedByValue('');
      activeIndex = -1;
      closeList();
    }
    // Attach to wrap for external use
    selectWrap._reset = resetCustomSelect;
  }
  initCustomSelect();

  form.addEventListener('change', (e) => {
    if (e.target.matches('input[type="radio"]')) {
      // Sync visual state for browsers without :has support
      const input = e.target;
      const label = input.closest('.rating-option');
      const group = input.closest('.rating-options');
      if (group && label) {
        group.querySelectorAll('.rating-option').forEach(opt => {
          opt.classList.remove('is-selected', 'is-bad', 'is-neutral', 'is-good', 'is-verygood');
        });
        label.classList.add('is-selected');
        // Also mark type for color-coded icons without :has
        if (label.classList.contains('type-bad')) label.classList.add('is-bad');
        else if (label.classList.contains('type-neutral')) label.classList.add('is-neutral');
        else if (label.classList.contains('type-good')) label.classList.add('is-good');
        else if (label.classList.contains('type-verygood')) label.classList.add('is-verygood');
      }
      updateSendState();
    }
  });

  // Submit / Send to backend
  sendButton.addEventListener('click', async () => {
    if (sendButton.disabled) return;

    // Build payload following response_example.json shape
    const activeTab = (document.querySelector('.tab.is-active')?.dataset.tab) || 'fixe';
    // Provider label from custom select label or native select option text
    const providerLabel = document.querySelector('.select-wrap .select-label')?.textContent?.trim();
    const nativeProvider = operator.options[operator.selectedIndex]?.text?.trim();
    const provider = providerLabel && providerLabel !== 'Select an operator' ? providerLabel : (nativeProvider || '');

    // Map ratings from DOM: each .rating-card is a criterion
    const fieldsets = Array.from(form.querySelectorAll('.rating-card'));
    const ratingsArr = [];
    let idx = 1;
    fieldsets.forEach(fs => {
      const checked = fs.querySelector('input[type="radio"]:checked');
      if (!checked) return;
      const label = fs.querySelector('.rating-title')?.textContent?.trim() || '';
      const sublabel = fs.querySelector('.rating-desc')?.textContent?.trim() || '';
      // bad=1, neutral=2, good=3, verygood=4
      const labelEl = checked.closest('label');
      let ratingNum = '';
      if (labelEl?.classList.contains('type-bad')) ratingNum = '1';
      else if (labelEl?.classList.contains('type-neutral')) ratingNum = '2';
      else if (labelEl?.classList.contains('type-good')) ratingNum = '3';
      else if (labelEl?.classList.contains('type-verygood')) ratingNum = '4';
      if (!ratingNum) return;
      const key = `crit-${idx++}`;
      ratingsArr.push({ [key]: { label, sublabel, rating: ratingNum } });
    });

    const payload = {
      type: activeTab,
      provider,
      ratings: ratingsArr,
    };

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Success => open dialog
      if (typeof successDialog.showModal === 'function') successDialog.showModal();
      else successDialog.setAttribute('open', 'open');
    } catch (err) {
      console.error('Failed to send feedback', err);
      alert('Une erreur est survenue lors de l\'envoi. Merci de réessayer.');
    }
  });

  // Close dialog -> reset form
  closeDialogBtn.addEventListener('click', () => {
    // The dialog will close automatically due to method="dialog"
    // We reset after a microtask to ensure dialog is closed first
    setTimeout(() => {
      form.reset();
      // Clear visual selection fallbacks
      form.querySelectorAll('.rating-option').forEach(opt => {
        opt.classList.remove('is-selected', 'is-bad', 'is-neutral', 'is-good', 'is-verygood');
      });
      updateSendState();
      // Reset active tab to Fixe
      const fixe = document.getElementById('tab-fixe');
      tabs.forEach(t => {
        t.classList.toggle('is-active', t === fixe);
        t.setAttribute('aria-selected', t === fixe ? 'true' : 'false');
      });
      panel.setAttribute('aria-labelledby', 'tab-fixe');
      // Reset custom operator dropdown UI if present
      const wrap = document.querySelector('.select-wrap[data-target="operator"]');
      if (wrap && typeof wrap._reset === 'function') wrap._reset();
    }, 0);
  });

  // Initial state
  updateSendState();
})();
