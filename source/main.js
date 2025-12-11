(() => {
  const tabs = Array.from(document.querySelectorAll('.tab'));
  const panel = document.getElementById('panel-main');
  const operator = document.getElementById('operator');
  const operatorRow = document.getElementById('operator-row');
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
  const PROVIDERS = {
    mobile: ['ORANGE', 'MTN', 'MOOV'],
    fixe: ['ORANGE', 'MTN', 'MOOV', 'GVA', 'CI DATA', 'VIPNET', 'KONNECT AFRICA', 'DATACONNECT'],
    ciperf: [],
  };

  const CRITERIA = {
    mobile: [
      'Disponibilité du service',
      'Qualité d’appel voix',
      'Envoi/réception SMS',
      'Disponibilité de l’Internet',
      'Vitesse de navigation web',
      'Qualité lecture video',
      'Consommation de crédit ou forfait',
      'Disponibilité/Qualité du SAV',
    ],
    fixe: [
      'Disponibilité du réseau',
      'Qualité d’appel voix',
      'Disponibilité de l’Internet',
      'Vitesse de navigation web',
      'Qualité lecture video',
      'Disponibilité/Qualité du SAV',
    ],
    ciperf: [
      'Facilité d’installation',
      'Facilité d’utilisation',
      'Design graphique',
      'Satisfaction',
    ],
  };

  function activeTabKey() {
    return (document.querySelector('.tab.is-active')?.dataset.tab) || 'fixe';
  }

  function sanitizeName(s) {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  function renderRatingsForTab(tabKey) {
    const container = form.querySelector('section.ratings');
    if (!container) return;
    container.innerHTML = '';
    const list = CRITERIA[tabKey] || [];
    list.forEach((labelText) => {
      const group = sanitizeName(labelText) || `crit_${Math.random().toString(36).slice(2, 7)}`;
      const card = document.createElement('div');
      card.className = 'rating-card';
      card.setAttribute('role', 'group');
      card.setAttribute('aria-labelledby', `title-${group}`);
      card.innerHTML = `
        <h4 id="title-${group}" class="rating-title">${labelText}</h4>
        <p class="rating-desc"></p>
        <div class="rating-options" data-group="${group}">
          <label class="rating-option type-bad">
            <input type="radio" name="${group}" value="bad" />
            <span class="sr-only">Mauvais</span>
            <span class="icon icon-bad" aria-hidden="true"></span>
          </label>
          <label class="rating-option type-neutral">
            <input type="radio" name="${group}" value="neutral" />
            <span class="sr-only">Moyen</span>
            <span class="icon icon-neutral" aria-hidden="true"></span>
          </label>
          <label class="rating-option type-good">
            <input type="radio" name="${group}" value="good" />
            <span class="sr-only">Bon</span>
            <span class="icon icon-good" aria-hidden="true"></span>
          </label>
          <label class="rating-option type-verygood">
            <input type="radio" name="${group}" value="verygood" />
            <span class="sr-only">Très bon</span>
            <span class="icon icon-verygood" aria-hidden="true"></span>
          </label>
        </div>
      `;
      container.appendChild(card);
    });
  }

  function populateProviders(tabKey) {
    const options = PROVIDERS[tabKey] || [];
    // Show/hide operator row
    const isCiPerf = tabKey === 'ciperf';
    if (operatorRow) operatorRow.style.display = isCiPerf ? 'none' : '';
    if (!operator) return;
    operator.required = !isCiPerf;
    operator.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Sélectionner un opérateur';
    operator.appendChild(placeholder);
    options.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      operator.appendChild(opt);
    });
    // Update custom dropdown as well
    const wrap = document.querySelector('.select-wrap[data-target="operator"]');
    if (wrap && typeof wrap._setOptions === 'function') {
      wrap._setOptions(options);
    }
  }

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
    const tab = activeTabKey();
    const operatorChosen = tab === 'ciperf' ? true : !!operator.value;
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
      // Switch operator options and ratings per tab
      const key = tab.dataset.tab;
      populateProviders(key);
      renderRatingsForTab(key);
      // Clear previous selections
      form.querySelectorAll('.rating-option').forEach(opt => {
        opt.classList.remove('is-selected', 'is-bad', 'is-neutral', 'is-good', 'is-verygood');
      });
      // Reset custom dropdown label when switching tabs
      const wrap = document.querySelector('.select-wrap[data-target="operator"]');
      if (wrap && typeof wrap._reset === 'function') wrap._reset();
      updateSendState();
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
    let options = Array.from(selectWrap.querySelectorAll('.select-option'));
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

    function logoPathForValue(v) {
      if (!v) return '';
      const key = v.toLowerCase().replace(/\s+/g, '_');
      return `/images/operators/${key}.png`;
    }

    function updateTriggerLogo(value) {
      const imgEl = trigger.querySelector('img.select-logo');
      if (!imgEl) return;
      if (!value) {
        imgEl.style.display = 'none';
        imgEl.removeAttribute('src');
        return;
      }
      const src = logoPathForValue(value);
      imgEl.style.display = 'none';
      imgEl.src = src;
      imgEl.onload = () => { imgEl.style.display = 'inline-block'; };
      imgEl.onerror = () => { imgEl.style.display = 'none'; };
    }

    function setValue(value, text) {
      native.value = value;
      labelEl.textContent = text;
      updateTriggerLogo(value);
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

    function attachOptionHandlers() {
      options.forEach((opt, i) => {
        opt.addEventListener('click', onOptionClick);
        opt.addEventListener('focus', () => { activeIndex = i; });
      });
    }

    // Allow updating options dynamically (e.g. when switching tabs)
    function setOptions(values) {
      // Rebuild list DOM
      list.innerHTML = '';
      values.forEach(v => {
        const li = document.createElement('li');
        li.className = 'select-option';
        li.setAttribute('role', 'option');
        li.dataset.value = v;
        li.setAttribute('aria-selected', 'false');
        // Bullet (radio-like)
        const bullet = document.createElement('span');
        bullet.className = 'opt-bullet';
        bullet.setAttribute('aria-hidden', 'true');
        // Optional logo
        const img = document.createElement('img');
        img.className = 'opt-logo';
        img.alt = '';
        const src = logoPathForValue(v);
        img.style.display = 'none';
        img.src = src;
        img.onload = () => { img.style.display = 'inline-block'; };
        img.onerror = () => { img.style.display = 'none'; };
        // Text
        const text = document.createElement('span');
        text.className = 'opt-text';
        text.textContent = v;
        // Assemble
        li.appendChild(bullet);
        li.appendChild(img);
        li.appendChild(text);
        list.appendChild(li);
      });
      options = Array.from(selectWrap.querySelectorAll('.select-option'));
      // Make options focusable for keyboard nav
      options.forEach((opt) => opt.setAttribute('tabindex', '-1'));
      // Reset selection and label
      setValue('', 'Select an operator');
      attachOptionHandlers();
    }

    // Events
    trigger.addEventListener('click', toggleList);
    trigger.addEventListener('keydown', onTriggerKey);
    list.addEventListener('keydown', onListKey);
    attachOptionHandlers();
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

    // Expose reset and setOptions for external updates
    function resetCustomSelect() {
      labelEl.textContent = 'Select an operator';
      setSelectedByValue('');
      activeIndex = -1;
      closeList();
      updateTriggerLogo('');
    }
    // Attach to wrap for external use
    selectWrap._reset = resetCustomSelect;
    selectWrap._setOptions = setOptions;
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
    // Provider from native select (custom UI hidden). For CiPerf, provider is empty.
    const nativeProvider = operator?.options?.[operator.selectedIndex]?.text?.trim() || '';
    const provider = activeTab === 'ciperf' ? '' : nativeProvider;

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

    const comments = document.getElementById('comments')?.value?.trim() || '';
    const attachmentInput = document.getElementById('attachment');
    let attachmentName = '';
    if (attachmentInput && attachmentInput.files && attachmentInput.files[0]) {
      try {
        const fd = new FormData();
        fd.append('file', attachmentInput.files[0]);
        const up = await fetch('/api/upload', { method: 'POST', body: fd });
        if (up.ok) {
          const j = await up.json();
          attachmentName = j.filename || attachmentInput.files[0].name;
        } else {
          console.warn('Upload failed with HTTP', up.status);
        }
      } catch (e) {
        console.warn('Upload error', e);
      }
    }

    // URL Params Extraction
    const urlParams = new URLSearchParams(window.location.search);
    const urlUuid = urlParams.get('uuid') || null;
    const urlContext = urlParams.get('context') ? decodeURIComponent(urlParams.get('context')) : null;

    const payload = {
      type: activeTab,
      provider,
      ratings: ratingsArr,
      comments,
      attachment: attachmentName,
      nperf_test_id: urlUuid,
      sector: urlContext
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
      // Re-render UI for fixe
      populateProviders('fixe');
      renderRatingsForTab('fixe');
      const wrap2 = document.querySelector('.select-wrap[data-target="operator"]');
      if (wrap2 && typeof wrap2._reset === 'function') wrap2._reset();
    }, 0);
  });

  // Initial state
  populateProviders('fixe');
  renderRatingsForTab('fixe');
  updateSendState();
})();
