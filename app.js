/**
 * OmniCalc — Daily Smart Calculator & Utilities
 * Features: Arithmetic engine, live calculation preview, history tape,
 * Web Audio haptic clicks, Tip/Bill splitter, Unit Converter, Discount calc.
 */

(function () {
  'use strict';

  /* ================= STATE MANAGEMENT ================= */
  const state = {
    mode: 'calc', // 'calc' | 'tip' | 'convert' | 'discount'
    theme: localStorage.getItem('omnicalc_theme') || 'obsidian',
    soundEnabled: localStorage.getItem('omnicalc_sound') !== 'false',
    expression: '',
    lastResult: null,
    isEvaluated: false,
    memory: parseFloat(localStorage.getItem('omnicalc_memory')) || 0,
    hasMemory: localStorage.getItem('omnicalc_has_mem') === 'true',
    history: JSON.parse(localStorage.getItem('omnicalc_history') || '[]'),
    
    // Unit converter active category
    unitCategory: 'length'
  };

  /* ================= WEB AUDIO TACTILE FEEDBACK ================= */
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playKeyTone(type = 'num') {
    if (!state.soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      let freq = 600;
      let duration = 0.035;

      if (type === 'op') {
        freq = 840;
        duration = 0.045;
      } else if (type === 'equal') {
        freq = 1100;
        duration = 0.07;
      } else if (type === 'fn') {
        freq = 420;
        duration = 0.03;
      }

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {
      // Audio might be blocked before first user interaction
    }
  }

  /* ================= DOM ELEMENTS ================= */
  const els = {
    // General
    toast: document.getElementById('toast'),
    soundToggleBtn: document.getElementById('sound-toggle-btn'),
    soundOnIcon: document.querySelector('.sound-on-icon'),
    soundOffIcon: document.querySelector('.sound-off-icon'),
    themeBtn: document.getElementById('theme-btn'),
    themeMenu: document.getElementById('theme-menu'),
    themeOptions: document.querySelectorAll('.theme-option'),
    modeTabs: document.querySelectorAll('.tab-btn'),
    modeViews: document.querySelectorAll('.mode-view'),
    
    // History
    historyToggleBtn: document.getElementById('history-toggle-btn'),
    historyBadge: document.getElementById('history-badge'),
    historySidebar: document.getElementById('history-sidebar'),
    historyList: document.getElementById('history-list'),
    historyEmpty: document.getElementById('history-empty'),
    clearHistoryBtn: document.getElementById('clear-history-btn'),
    closeHistoryBtn: document.getElementById('close-history-btn'),

    // Calculator Display
    expressionDisplay: document.getElementById('expression-display'),
    resultDisplay: document.getElementById('result-display'),
    previewPrefix: document.getElementById('preview-prefix'),
    copyResultBtn: document.getElementById('copy-result-btn'),
    memBadge: document.getElementById('mem-badge'),
    memVal: document.getElementById('mem-val'),

    // Tip Calculator
    tipBillInput: document.getElementById('tip-bill-input'),
    tipChips: document.querySelectorAll('#tip-chips .chip-btn'),
    tipSlider: document.getElementById('tip-slider'),
    tipPercentLabel: document.getElementById('tip-percent-label'),
    splitCountInput: document.getElementById('split-count'),
    splitMinusBtn: document.getElementById('split-minus'),
    splitPlusBtn: document.getElementById('split-plus'),
    tipPerPersonTotal: document.getElementById('tip-per-person-total'),
    tipTotalAmount: document.getElementById('tip-total-amount'),
    tipFinalTotal: document.getElementById('tip-final-total'),
    tipPerPersonTip: document.getElementById('tip-per-person-tip'),
    tipPerPersonBill: document.getElementById('tip-per-person-bill'),

    // Unit Converter
    unitCatTabs: document.querySelectorAll('#unit-cat-tabs .unit-cat-btn'),
    unitFromVal: document.getElementById('unit-from-val'),
    unitToVal: document.getElementById('unit-to-val'),
    unitFromSelect: document.getElementById('unit-from-select'),
    unitToSelect: document.getElementById('unit-to-select'),
    unitSwapBtn: document.getElementById('unit-swap-btn'),
    unitFormulaDisplay: document.getElementById('unit-formula-display'),

    // Discount Calculator
    discPriceInput: document.getElementById('disc-price-input'),
    discChips: document.querySelectorAll('#disc-chips .chip-btn'),
    discSlider: document.getElementById('disc-slider'),
    discPercentLabel: document.getElementById('disc-percent-label'),
    discExtraInput: document.getElementById('disc-extra-input'),
    discTaxInput: document.getElementById('disc-tax-input'),
    discFinalPrice: document.getElementById('disc-final-price'),
    discSavingsAmount: document.getElementById('disc-savings-amount'),
    discSubtotal: document.getElementById('disc-subtotal'),
    discTaxAmount: document.getElementById('disc-tax-amount'),
    discOrigDisplay: document.getElementById('disc-orig-display')
  };

  /* ================= INITIALIZATION ================= */
  function init() {
    applyTheme(state.theme);
    updateSoundUI();
    updateMemoryUI();
    renderHistory();
    setupEventListeners();
    setupUnitConverter();
    calculateTip();
    calculateDiscount();
  }

  /* ================= TOAST NOTIFICATIONS ================= */
  let toastTimer = null;
  function showToast(message = 'Copied to clipboard!') {
    els.toast.textContent = message;
    els.toast.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.classList.add('hidden');
    }, 2200);
  }

  /* ================= THEME & SOUND CONTROLS ================= */
  function applyTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    state.theme = themeName;
    localStorage.setItem('omnicalc_theme', themeName);

    els.themeOptions.forEach(opt => {
      opt.classList.toggle('active', opt.dataset.setTheme === themeName);
    });
  }

  function updateSoundUI() {
    if (state.soundEnabled) {
      els.soundOnIcon.classList.remove('hidden');
      els.soundOffIcon.classList.add('hidden');
    } else {
      els.soundOnIcon.classList.add('hidden');
      els.soundOffIcon.classList.remove('hidden');
    }
    localStorage.setItem('omnicalc_sound', state.soundEnabled);
  }

  /* ================= CALCULATOR ENGINE ================= */

  /**
   * Cleans and prepares math expression for safe evaluation
   */
  function sanitizeForEval(expr) {
    if (!expr) return '0';
    let clean = expr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/,/g, '');

    // Handle percentage calculations: e.g. 50 + 10% => 50 + (50 * 0.1) or 200 * 20% => 200 * 0.2
    clean = clean.replace(/(\d+(\.\d+)?)%/g, (match, p1) => {
      return `(${p1}/100)`;
    });

    return clean;
  }

  /**
   * Safely evaluates math expressions using standard operator precedence
   */
  function evaluateMath(expressionStr) {
    if (!expressionStr || expressionStr.trim() === '') return 0;
    try {
      const sanitized = sanitizeForEval(expressionStr);
      // Ensure only allowed characters for security
      if (!/^[0-9+\-*/().\s]+$/.test(sanitized)) {
        return null;
      }
      // Evaluate using Function sandbox
      const result = new Function(`'use strict'; return (${sanitized});`)();
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        // Round floating precision anomalies (e.g. 0.1 + 0.2 = 0.30000000000000004 -> 0.3)
        return Number(Math.round(result + 'e+12') + 'e-12');
      }
      return null;
    } catch (err) {
      return null;
    }
  }

  /**
   * Format number for display with commas and readable scale
   */
  function formatDisplayNumber(num) {
    if (num === null || num === undefined) return '0';
    if (isNaN(num)) return 'Error';
    if (!isFinite(num)) return 'Infinity';

    const str = num.toString();
    if (str.length > 13 || Math.abs(num) >= 1e12 || (Math.abs(num) > 0 && Math.abs(num) < 1e-6)) {
      return num.toExponential(6).replace('e+', 'e');
    }

    const parts = str.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  /**
   * Updates Calculator UI screen with expression and dynamic sizing
   */
  function updateCalcDisplay() {
    // Expression Line
    els.expressionDisplay.textContent = state.expression;
    els.expressionDisplay.scrollLeft = els.expressionDisplay.scrollWidth;

    // Live preview evaluation
    if (state.expression && !state.isEvaluated) {
      const interim = evaluateMath(state.expression);
      if (interim !== null) {
        els.previewPrefix.textContent = '=';
        els.resultDisplay.textContent = formatDisplayNumber(interim);
      } else {
        els.previewPrefix.textContent = '';
      }
    } else if (state.isEvaluated && state.lastResult !== null) {
      els.previewPrefix.textContent = '';
      els.resultDisplay.textContent = formatDisplayNumber(state.lastResult);
    } else {
      els.previewPrefix.textContent = '';
      els.resultDisplay.textContent = '0';
    }

    // Dynamic Font Scaling to prevent overflow
    const textLen = els.resultDisplay.textContent.length;
    if (textLen > 14) {
      els.resultDisplay.style.fontSize = '1.4rem';
    } else if (textLen > 10) {
      els.resultDisplay.style.fontSize = '1.8rem';
    } else if (textLen > 7) {
      els.resultDisplay.style.fontSize = '2.1rem';
    } else {
      els.resultDisplay.style.fontSize = '2.5rem';
    }
  }

  function handleNumberInput(digit) {
    playKeyTone('num');
    if (state.isEvaluated) {
      state.expression = '';
      state.isEvaluated = false;
    }

    // Prevent multiple leading zeroes
    if (state.expression === '0' && digit !== '.') {
      state.expression = digit;
    } else {
      state.expression += digit;
    }
    updateCalcDisplay();
  }

  function handleDecimalInput() {
    playKeyTone('num');
    if (state.isEvaluated) {
      state.expression = '0.';
      state.isEvaluated = false;
      updateCalcDisplay();
      return;
    }

    // Find the last number token in current expression
    const tokens = state.expression.split(/[+\−×÷]/);
    const lastToken = tokens[tokens.length - 1];

    if (!lastToken.includes('.')) {
      if (lastToken === '' || /^[+\−×÷(]$/.test(state.expression.slice(-1))) {
        state.expression += '0.';
      } else {
        state.expression += '.';
      }
      updateCalcDisplay();
    }
  }

  function handleOperatorInput(opSymbol) {
    playKeyTone('op');
    let displayOp = opSymbol;
    if (opSymbol === '/') displayOp = '÷';
    if (opSymbol === '*') displayOp = '×';
    if (opSymbol === '-') displayOp = '−';
    if (opSymbol === '+') displayOp = '+';

    if (state.isEvaluated) {
      state.expression = (state.lastResult !== null ? state.lastResult.toString() : '0') + ' ' + displayOp + ' ';
      state.isEvaluated = false;
    } else if (state.expression === '') {
      if (displayOp === '−') {
        state.expression = '−';
      } else {
        state.expression = '0 ' + displayOp + ' ';
      }
    } else {
      const trimmed = state.expression.trim();
      const lastChar = trimmed.slice(-1);
      if (['+', '−', '×', '÷'].includes(lastChar)) {
        state.expression = trimmed.slice(0, -1).trim() + ' ' + displayOp + ' ';
      } else {
        state.expression = trimmed + ' ' + displayOp + ' ';
      }
    }
    updateCalcDisplay();
  }

  function handleParenthesis() {
    playKeyTone('fn');
    if (state.isEvaluated) {
      state.expression = '(';
      state.isEvaluated = false;
      updateCalcDisplay();
      return;
    }

    const openCount = (state.expression.match(/\(/g) || []).length;
    const closeCount = (state.expression.match(/\)/g) || []).length;
    const lastChar = state.expression.trim().slice(-1);

    // If there's an unmatched open paren and the last char is a number or close paren, close it
    if (openCount > closeCount && (/\d|\)/.test(lastChar))) {
      state.expression += ')';
    } else {
      if (/\d|\)/.test(lastChar)) {
        state.expression += ' × (';
      } else {
        state.expression += '(';
      }
    }
    updateCalcDisplay();
  }

  function handleCalculate() {
    playKeyTone('equal');
    if (!state.expression) return;

    // Auto-close any unclosed parentheses
    let exprToEval = state.expression.trim();
    const openCount = (exprToEval.match(/\(/g) || []).length;
    const closeCount = (exprToEval.match(/\)/g) || []).length;
    if (openCount > closeCount) {
      exprToEval += ')'.repeat(openCount - closeCount);
    }

    const result = evaluateMath(exprToEval);
    if (result !== null) {
      addHistoryItem(exprToEval, result);
      state.lastResult = result;
      state.expression = exprToEval;
      state.isEvaluated = true;
      updateCalcDisplay();
    } else {
      els.resultDisplay.textContent = 'Invalid Format';
    }
  }

  function handleClear() {
    playKeyTone('fn');
    state.expression = '';
    state.lastResult = null;
    state.isEvaluated = false;
    updateCalcDisplay();
  }

  function handleBackspace() {
    playKeyTone('fn');
    if (state.isEvaluated) {
      state.expression = '';
      state.isEvaluated = false;
      updateCalcDisplay();
      return;
    }

    let expr = state.expression.trim();
    if (expr.length > 0) {
      // If ends with spaced operator (e.g. " + ")
      if (/[+−×÷]\s*$/.test(expr)) {
        state.expression = expr.replace(/\s*[+−×÷]\s*$/, '');
      } else {
        state.expression = expr.slice(0, -1);
      }
    }
    updateCalcDisplay();
  }

  function handleSquareRoot() {
    playKeyTone('fn');
    const val = getCurrentActiveNumber();
    if (val < 0) {
      showToast('Cannot take square root of negative');
      return;
    }
    const res = Math.sqrt(val);
    replaceCurrentNumberWith(res);
  }

  function handleSquare() {
    playKeyTone('fn');
    const val = getCurrentActiveNumber();
    const res = val * val;
    replaceCurrentNumberWith(res);
  }

  function handleInvert() {
    playKeyTone('fn');
    const val = getCurrentActiveNumber();
    if (val === 0) {
      showToast('Cannot divide by zero');
      return;
    }
    const res = 1 / val;
    replaceCurrentNumberWith(res);
  }

  function handleNegate() {
    playKeyTone('fn');
    if (state.isEvaluated && state.lastResult !== null) {
      state.lastResult = -state.lastResult;
      state.expression = state.lastResult.toString();
      updateCalcDisplay();
      return;
    }

    if (!state.expression) {
      state.expression = '−';
      updateCalcDisplay();
      return;
    }

    // Toggle negation on last number token
    const lastNumMatch = state.expression.match(/([−\-]?\d+(\.\d+)?)\s*$/);
    if (lastNumMatch) {
      const fullMatch = lastNumMatch[1];
      const prefix = state.expression.slice(0, -lastNumMatch[0].length);
      let replaced;
      if (fullMatch.startsWith('−') || fullMatch.startsWith('-')) {
        replaced = fullMatch.replace(/^[−\-]/, '');
      } else {
        replaced = '−' + fullMatch;
      }
      state.expression = prefix + replaced;
      updateCalcDisplay();
    }
  }

  function handlePercent() {
    playKeyTone('fn');
    if (!state.expression) return;
    if (!state.expression.endsWith('%')) {
      state.expression += '%';
      updateCalcDisplay();
    }
  }

  function getCurrentActiveNumber() {
    if (state.isEvaluated && state.lastResult !== null) {
      return state.lastResult;
    }
    const interim = evaluateMath(state.expression);
    return interim !== null ? interim : 0;
  }

  function replaceCurrentNumberWith(newNum) {
    const rounded = Number(Math.round(newNum + 'e+10') + 'e-10');
    state.expression = rounded.toString();
    state.lastResult = rounded;
    state.isEvaluated = true;
    updateCalcDisplay();
  }

  /* ================= MEMORY FUNCTIONS ================= */
  function updateMemoryUI() {
    if (state.hasMemory) {
      els.memBadge.classList.remove('hidden');
      els.memVal.textContent = formatDisplayNumber(state.memory);
    } else {
      els.memBadge.classList.add('hidden');
    }
    localStorage.setItem('omnicalc_memory', state.memory);
    localStorage.setItem('omnicalc_has_mem', state.hasMemory);
  }

  function handleMemory(action) {
    playKeyTone('fn');
    const currentVal = getCurrentActiveNumber();

    switch (action) {
      case 'mc':
        state.memory = 0;
        state.hasMemory = false;
        showToast('Memory Cleared');
        break;
      case 'mr':
        if (state.hasMemory) {
          if (state.isEvaluated || !state.expression) {
            state.expression = state.memory.toString();
            state.isEvaluated = false;
          } else {
            state.expression += state.memory.toString();
          }
          updateCalcDisplay();
          showToast(`Recalled ${formatDisplayNumber(state.memory)}`);
        }
        break;
      case 'm-plus':
        state.memory += currentVal;
        state.hasMemory = true;
        showToast(`Memory + ${formatDisplayNumber(currentVal)}`);
        break;
      case 'm-minus':
        state.memory -= currentVal;
        state.hasMemory = true;
        showToast(`Memory − ${formatDisplayNumber(currentVal)}`);
        break;
      case 'ms':
        state.memory = currentVal;
        state.hasMemory = true;
        showToast(`Stored ${formatDisplayNumber(currentVal)}`);
        break;
    }
    updateMemoryUI();
  }

  /* ================= HISTORY MANAGEMENT ================= */
  function addHistoryItem(expression, result) {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const item = {
      id: Date.now(),
      expr: expression,
      res: result,
      time: timeStr
    };

    state.history.unshift(item);
    if (state.history.length > 50) state.history.pop();
    localStorage.setItem('omnicalc_history', JSON.stringify(state.history));
    renderHistory();
  }

  function renderHistory() {
    const count = state.history.length;
    if (count > 0) {
      els.historyBadge.textContent = count;
      els.historyBadge.classList.remove('hidden');
      els.historyEmpty.classList.add('hidden');
      
      // Render entries
      els.historyList.innerHTML = '';
      state.history.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.setAttribute('tabindex', '0');
        div.setAttribute('role', 'button');
        div.setAttribute('aria-label', `${item.expr} equals ${item.res}`);
        div.innerHTML = `
          <div class="history-meta">
            <span>${item.time}</span>
            <span>Tap to load</span>
          </div>
          <div class="history-expr">${escapeHtml(item.expr)} =</div>
          <div class="history-res">${formatDisplayNumber(item.res)}</div>
        `;

        div.addEventListener('click', () => {
          playKeyTone('fn');
          state.expression = item.expr;
          state.lastResult = item.res;
          state.isEvaluated = true;
          updateCalcDisplay();
          switchMode('calc');
          if (window.innerWidth < 820) {
            els.historySidebar.classList.remove('open');
          }
          showToast('Equation loaded');
        });

        els.historyList.appendChild(div);
      });
    } else {
      els.historyBadge.classList.add('hidden');
      els.historyEmpty.classList.remove('hidden');
      els.historyList.innerHTML = '';
      els.historyList.appendChild(els.historyEmpty);
    }
  }

  function clearAllHistory() {
    playKeyTone('fn');
    state.history = [];
    localStorage.removeItem('omnicalc_history');
    renderHistory();
    showToast('History cleared');
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ================= MODE SWITCHING ================= */
  function switchMode(newMode) {
    state.mode = newMode;
    els.modeTabs.forEach(tab => {
      const isActive = tab.dataset.mode === newMode;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive);
    });

    els.modeViews.forEach(view => {
      view.classList.toggle('active', view.id === `view-${newMode}`);
    });
  }

  /* ================= DAILY UTILITY 1: TIP CALCULATOR ================= */
  function calculateTip() {
    const bill = parseFloat(els.tipBillInput.value) || 0;
    const tipPercent = parseFloat(els.tipSlider.value) || 0;
    const splitCount = Math.max(1, parseInt(els.splitCountInput.value, 10) || 1);

    const tipTotal = bill * (tipPercent / 100);
    const finalTotal = bill + tipTotal;
    const perPersonTotal = finalTotal / splitCount;
    const perPersonTip = tipTotal / splitCount;
    const perPersonBill = bill / splitCount;

    els.tipPercentLabel.textContent = `${tipPercent}%`;
    els.tipPerPersonTotal.textContent = `$${perPersonTotal.toFixed(2)}`;
    els.tipTotalAmount.textContent = `$${tipTotal.toFixed(2)}`;
    els.tipFinalTotal.textContent = `$${finalTotal.toFixed(2)}`;
    els.tipPerPersonTip.textContent = `$${perPersonTip.toFixed(2)}`;
    els.tipPerPersonBill.textContent = `$${perPersonBill.toFixed(2)}`;
  }

  /* ================= DAILY UTILITY 2: UNIT CONVERTER ================= */
  const UNIT_DATA = {
    length: {
      units: [
        { id: 'm', label: 'Meters (m)', factor: 1 },
        { id: 'km', label: 'Kilometers (km)', factor: 1000 },
        { id: 'cm', label: 'Centimeters (cm)', factor: 0.01 },
        { id: 'mm', label: 'Millimeters (mm)', factor: 0.001 },
        { id: 'mi', label: 'Miles (mi)', factor: 1609.344 },
        { id: 'yd', label: 'Yards (yd)', factor: 0.9144 },
        { id: 'ft', label: 'Feet (ft)', factor: 0.3048 },
        { id: 'in', label: 'Inches (in)', factor: 0.0254 }
      ],
      defaultFrom: 'm',
      defaultTo: 'cm'
    },
    weight: {
      units: [
        { id: 'kg', label: 'Kilograms (kg)', factor: 1 },
        { id: 'g', label: 'Grams (g)', factor: 0.001 },
        { id: 'mg', label: 'Milligrams (mg)', factor: 0.000001 },
        { id: 'lb', label: 'Pounds (lb)', factor: 0.45359237 },
        { id: 'oz', label: 'Ounces (oz)', factor: 0.028349523125 }
      ],
      defaultFrom: 'kg',
      defaultTo: 'lb'
    },
    temp: {
      units: [
        { id: 'c', label: 'Celsius (°C)' },
        { id: 'f', label: 'Fahrenheit (°F)' },
        { id: 'k', label: 'Kelvin (K)' }
      ],
      defaultFrom: 'c',
      defaultTo: 'f',
      isTemp: true
    },
    area: {
      units: [
        { id: 'm2', label: 'Square Meters (m²)', factor: 1 },
        { id: 'km2', label: 'Square Kilometers (km²)', factor: 1000000 },
        { id: 'ft2', label: 'Square Feet (ft²)', factor: 0.092903 },
        { id: 'ac', label: 'Acres (ac)', factor: 4046.8564 },
        { id: 'ha', label: 'Hectares (ha)', factor: 10000 }
      ],
      defaultFrom: 'm2',
      defaultTo: 'ft2'
    },
    volume: {
      units: [
        { id: 'l', label: 'Liters (L)', factor: 1 },
        { id: 'ml', label: 'Milliliters (mL)', factor: 0.001 },
        { id: 'gal', label: 'US Gallons (gal)', factor: 3.78541 },
        { id: 'qt', label: 'US Quarts (qt)', factor: 0.946353 },
        { id: 'pt', label: 'US Pints (pt)', factor: 0.473176 },
        { id: 'cup', label: 'US Cups (cup)', factor: 0.236588 },
        { id: 'floz', label: 'Fluid Ounces (fl oz)', factor: 0.0295735 }
      ],
      defaultFrom: 'l',
      defaultTo: 'gal'
    },
    speed: {
      units: [
        { id: 'kmh', label: 'Kilometers/hour (km/h)', factor: 1 },
        { id: 'mph', label: 'Miles/hour (mph)', factor: 1.609344 },
        { id: 'ms', label: 'Meters/second (m/s)', factor: 3.6 },
        { id: 'knot', label: 'Knots (kn)', factor: 1.852 }
      ],
      defaultFrom: 'kmh',
      defaultTo: 'mph'
    }
  };

  function setupUnitConverter() {
    populateUnitSelects();
    convertUnits(true);
  }

  function populateUnitSelects() {
    const catData = UNIT_DATA[state.unitCategory];
    if (!catData) return;

    els.unitFromSelect.innerHTML = '';
    els.unitToSelect.innerHTML = '';

    catData.units.forEach(unit => {
      const optFrom = document.createElement('option');
      optFrom.value = unit.id;
      optFrom.textContent = unit.label;
      els.unitFromSelect.appendChild(optFrom);

      const optTo = document.createElement('option');
      optTo.value = unit.id;
      optTo.textContent = unit.label;
      els.unitToSelect.appendChild(optTo);
    });

    els.unitFromSelect.value = catData.defaultFrom;
    els.unitToSelect.value = catData.defaultTo;
  }

  function convertUnits(fromSource = true) {
    const catData = UNIT_DATA[state.unitCategory];
    if (!catData) return;

    const fromUnitId = els.unitFromSelect.value;
    const toUnitId = els.unitToSelect.value;

    if (catData.isTemp) {
      // Temperature conversion formula
      if (fromSource) {
        const val = parseFloat(els.unitFromVal.value) || 0;
        let cVal = val;
        if (fromUnitId === 'f') cVal = (val - 32) * (5 / 9);
        if (fromUnitId === 'k') cVal = val - 273.15;

        let result = cVal;
        if (toUnitId === 'f') result = (cVal * (9 / 5)) + 32;
        if (toUnitId === 'k') result = cVal + 273.15;

        els.unitToVal.value = parseFloat(result.toFixed(4));
        els.unitFormulaDisplay.textContent = `1 ${fromUnitId.toUpperCase()} = ${formatDisplayNumber(result)} ${toUnitId.toUpperCase()}`;
      } else {
        const val = parseFloat(els.unitToVal.value) || 0;
        let cVal = val;
        if (toUnitId === 'f') cVal = (val - 32) * (5 / 9);
        if (toUnitId === 'k') cVal = val - 273.15;

        let result = cVal;
        if (fromUnitId === 'f') result = (cVal * (9 / 5)) + 32;
        if (fromUnitId === 'k') result = cVal + 273.15;

        els.unitFromVal.value = parseFloat(result.toFixed(4));
      }
      return;
    }

    const uFrom = catData.units.find(u => u.id === fromUnitId);
    const uTo = catData.units.find(u => u.id === toUnitId);
    if (!uFrom || !uTo) return;

    if (fromSource) {
      const val = parseFloat(els.unitFromVal.value) || 0;
      const baseValue = val * uFrom.factor;
      const converted = baseValue / uTo.factor;
      els.unitToVal.value = parseFloat(converted.toFixed(6));

      const ratio = uFrom.factor / uTo.factor;
      els.unitFormulaDisplay.textContent = `1 ${uFrom.id} = ${formatDisplayNumber(Number(ratio.toFixed(6)))} ${uTo.id}`;
    } else {
      const val = parseFloat(els.unitToVal.value) || 0;
      const baseValue = val * uTo.factor;
      const converted = baseValue / uFrom.factor;
      els.unitFromVal.value = parseFloat(converted.toFixed(6));
    }
  }

  /* ================= DAILY UTILITY 3: DISCOUNT & TAX ================= */
  function calculateDiscount() {
    const originalPrice = parseFloat(els.discPriceInput.value) || 0;
    const discountPercent = parseFloat(els.discSlider.value) || 0;
    const extraDiscountPercent = parseFloat(els.discExtraInput.value) || 0;
    const salesTaxPercent = parseFloat(els.discTaxInput.value) || 0;

    // First discount
    const mainSavings = originalPrice * (discountPercent / 100);
    const intermediatePrice = originalPrice - mainSavings;

    // Extra discount applied on intermediate
    const extraSavings = intermediatePrice * (extraDiscountPercent / 100);
    const subtotal = intermediatePrice - extraSavings;
    const totalSavings = originalPrice - subtotal;

    // Sales tax
    const taxAmount = subtotal * (salesTaxPercent / 100);
    const finalPrice = subtotal + taxAmount;

    const totalSavingsPercent = originalPrice > 0 ? (totalSavings / originalPrice) * 100 : 0;

    els.discPercentLabel.textContent = `${discountPercent}%`;
    els.discFinalPrice.textContent = `$${finalPrice.toFixed(2)}`;
    els.discSavingsAmount.textContent = `$${totalSavings.toFixed(2)} (${totalSavingsPercent.toFixed(1)}%)`;
    els.discSubtotal.textContent = `$${subtotal.toFixed(2)}`;
    els.discTaxAmount.textContent = `$${taxAmount.toFixed(2)}`;
    els.discOrigDisplay.textContent = `$${originalPrice.toFixed(2)}`;
  }

  /* ================= EVENT LISTENERS ================= */
  function setupEventListeners() {
    // Mode Switcher Tabs
    els.modeTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        playKeyTone('fn');
        switchMode(tab.dataset.mode);
      });
    });

    // Sound toggle
    els.soundToggleBtn.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      updateSoundUI();
      if (state.soundEnabled) playKeyTone('equal');
      showToast(state.soundEnabled ? 'Sound enabled' : 'Sound muted');
    });

    // Theme selector dropdown
    els.themeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      els.themeMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!els.themeMenu.contains(e.target) && e.target !== els.themeBtn) {
        els.themeMenu.classList.add('hidden');
      }
    });

    els.themeOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        applyTheme(opt.dataset.setTheme);
        els.themeMenu.classList.add('hidden');
        playKeyTone('fn');
        showToast(`Theme: ${opt.dataset.setTheme}`);
      });
    });

    // History Sidebar Toggles
    els.historyToggleBtn.addEventListener('click', () => {
      playKeyTone('fn');
      if (window.innerWidth < 820) {
        els.historySidebar.classList.toggle('open');
      } else {
        // Desktop smooth scroll or highlight
        els.historyList.focus();
        showToast('History Tape active');
      }
    });

    els.closeHistoryBtn.addEventListener('click', () => {
      els.historySidebar.classList.remove('open');
    });

    els.clearHistoryBtn.addEventListener('click', clearAllHistory);

    // Calculator Keypad Clicks
    const keypad = document.querySelector('.keypad-grid');
    keypad.addEventListener('click', (e) => {
      const btn = e.target.closest('.key-btn');
      if (!btn) return;

      const action = btn.dataset.action;
      const val = btn.dataset.val;

      switch (action) {
        case 'num':
          handleNumberInput(val);
          break;
        case 'decimal':
          handleDecimalInput();
          break;
        case 'operator':
          handleOperatorInput(val);
          break;
        case 'parenthesis':
          handleParenthesis();
          break;
        case 'calculate':
          handleCalculate();
          break;
        case 'clear':
          handleClear();
          break;
        case 'backspace':
          handleBackspace();
          break;
        case 'sqrt':
          handleSquareRoot();
          break;
        case 'sqr':
          handleSquare();
          break;
        case 'invert':
          handleInvert();
          break;
        case 'negate':
          handleNegate();
          break;
        case 'percent':
          handlePercent();
          break;
      }
    });

    // Memory Bar Clicks
    const memRow = document.querySelector('.memory-row');
    memRow.addEventListener('click', (e) => {
      const btn = e.target.closest('.mem-btn');
      if (!btn) return;
      handleMemory(btn.dataset.action);
    });

    // Copy Result Button
    els.copyResultBtn.addEventListener('click', () => {
      const textToCopy = els.resultDisplay.textContent.replace(/,/g, '');
      if (navigator.clipboard) {
        navigator.clipboard.writeText(textToCopy).then(() => {
          showToast(`Copied ${textToCopy}`);
        });
      } else {
        showToast(`Value: ${textToCopy}`);
      }
    });

    // Tip Calculator Events
    els.tipBillInput.addEventListener('input', calculateTip);
    els.tipSlider.addEventListener('input', () => {
      const val = els.tipSlider.value;
      els.tipChips.forEach(chip => chip.classList.toggle('active', chip.dataset.tip === val));
      calculateTip();
    });

    els.tipChips.forEach(chip => {
      chip.addEventListener('click', () => {
        playKeyTone('fn');
        els.tipChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        els.tipSlider.value = chip.dataset.tip;
        calculateTip();
      });
    });

    els.splitMinusBtn.addEventListener('click', () => {
      playKeyTone('fn');
      const val = Math.max(1, (parseInt(els.splitCountInput.value, 10) || 1) - 1);
      els.splitCountInput.value = val;
      calculateTip();
    });

    els.splitPlusBtn.addEventListener('click', () => {
      playKeyTone('fn');
      const val = (parseInt(els.splitCountInput.value, 10) || 1) + 1;
      els.splitCountInput.value = val;
      calculateTip();
    });

    els.splitCountInput.addEventListener('input', calculateTip);

    // Unit Converter Events
    els.unitCatTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        playKeyTone('fn');
        els.unitCatTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.unitCategory = tab.dataset.category;
        populateUnitSelects();
        convertUnits(true);
      });
    });

    els.unitFromVal.addEventListener('input', () => convertUnits(true));
    els.unitToVal.addEventListener('input', () => convertUnits(false));
    els.unitFromSelect.addEventListener('change', () => convertUnits(true));
    els.unitToSelect.addEventListener('change', () => convertUnits(true));

    els.unitSwapBtn.addEventListener('click', () => {
      playKeyTone('fn');
      const temp = els.unitFromSelect.value;
      els.unitFromSelect.value = els.unitToSelect.value;
      els.unitToSelect.value = temp;
      convertUnits(true);
    });

    // Discount Calculator Events
    els.discPriceInput.addEventListener('input', calculateDiscount);
    els.discSlider.addEventListener('input', () => {
      const val = els.discSlider.value;
      els.discChips.forEach(chip => chip.classList.toggle('active', chip.dataset.disc === val));
      calculateDiscount();
    });

    els.discChips.forEach(chip => {
      chip.addEventListener('click', () => {
        playKeyTone('fn');
        els.discChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        els.discSlider.value = chip.dataset.disc;
        calculateDiscount();
      });
    });

    els.discExtraInput.addEventListener('input', calculateDiscount);
    els.discTaxInput.addEventListener('input', calculateDiscount);

    // Keyboard Shortcuts
    window.addEventListener('keydown', handleKeyboardShortcuts);
  }

  /* ================= KEYBOARD NAVIGATION ================= */
  function handleKeyboardShortcuts(e) {
    // If user is currently typing in an input field in Utility mode, let normal typing occur
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
      return;
    }

    const key = e.key;

    if (/^[0-9]$/.test(key)) {
      e.preventDefault();
      animateKeyBtn(`[data-val="${key}"]`);
      handleNumberInput(key);
      return;
    }

    if (key === '.') {
      e.preventDefault();
      animateKeyBtn('[data-action="decimal"]');
      handleDecimalInput();
      return;
    }

    if (key === '+' || key === '-' || key === '*' || key === '/') {
      e.preventDefault();
      animateKeyBtn(`[data-val="${key}"]`);
      handleOperatorInput(key);
      return;
    }

    if (key === 'Enter' || key === '=') {
      e.preventDefault();
      animateKeyBtn('#key-equals');
      handleCalculate();
      return;
    }

    if (key === 'Backspace') {
      e.preventDefault();
      animateKeyBtn('#key-backspace');
      handleBackspace();
      return;
    }

    if (key === 'Escape') {
      e.preventDefault();
      animateKeyBtn('#key-clear');
      handleClear();
      return;
    }

    if (key === '(' || key === ')') {
      e.preventDefault();
      animateKeyBtn('[data-action="parenthesis"]');
      handleParenthesis();
      return;
    }

    if (key === '%') {
      e.preventDefault();
      animateKeyBtn('[data-action="percent"]');
      handlePercent();
      return;
    }
  }

  function animateKeyBtn(selector) {
    const btn = document.querySelector(selector);
    if (btn) {
      btn.classList.add('active-press');
      setTimeout(() => btn.classList.remove('active-press'), 120);
    }
  }

  // Run on DOM load
  document.addEventListener('DOMContentLoaded', init);

})();
