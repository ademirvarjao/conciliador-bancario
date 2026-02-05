const state = {
  transactions: [],
  accounts: [],
  rules: [],
  ledgerEntries: [],
  company: '',
  bank: '',
  currency: 'BRL',
};

const storageKey = 'conciliador-bancario-data-v1';

// Mapeamento de elementos com tratamento de erro básico
const elements = {
  fileInput: document.querySelector('#file-input'),
  parseFiles: document.querySelector('#parse-files'),
  importSummary: document.querySelector('#import-summary'),
  downloadUnified: document.querySelector('#download-unified'),
  accountsFile: document.querySelector('#accounts-file'),
  addAccount: document.querySelector('#add-account'),
  newAccount: document.querySelector('#new-account'),
  accountsList: document.querySelector('#accounts-list'),
  rulePattern: document.querySelector('#rule-pattern'),
  ruleAccount: document.querySelector('#rule-account'),
  addRule: document.querySelector('#add-rule'),
  rulesList: document.querySelector('#rules-list'),
  transactionsTable: document.querySelector('#transactions-table tbody'),
  searchTransactions: document.querySelector('#search-transactions'),
  filterStatus: document.querySelector('#filter-status'),
  ledgerInput: document.querySelector('#ledger-input'),
  toleranceDays: document.querySelector('#tolerance-days'),
  toleranceValue: document.querySelector('#tolerance-value'),
  runReconciliation: document.querySelector('#run-reconciliation'),
  reconciliationSummary: document.querySelector('#reconciliation-summary'),
  reconciliationTable: document.querySelector('#reconciliation-table tbody'),
  exportCsv: document.querySelector('#export-csv'),
  exportJson: document.querySelector('#export-json'),
  loadSamples: document.querySelector('#load-samples'),
  resetData: document.querySelector('#reset-data'),
  companyName: document.querySelector('#company-name'),
  bankName: document.querySelector('#bank-name'),
  currency: document.querySelector('#currency'),
  pdfNotes: document.querySelector('#pdf-notes'), // Adicionado referência faltante
};

// Gerador de ID robusto (fallback para contextos não-seguros)
function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

// Parser de valores numéricos flexível
function parseAmount(value, isOFX = false) {
  if (!value) return 0;
  let str = value.toString().trim();
  
  if (isOFX) {
    // OFX usa padrão ponto decimal: -123.45
    return parseFloat(str) || 0;
  }

  // Detecta se é formato brasileiro (1.234,56) ou internacional (1,234.56)
  const hasComma = str.includes(',');
  const hasDot = str.includes('.');

  if (hasComma && hasDot) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      // PT-BR: remove pontos de milhar, troca vírgula por ponto
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // EN: remove vírgulas de milhar
      str = str.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Apenas vírgula: assume que é o separador decimal
    str = str.replace(',', '.');
  }

  return parseFloat(str) || 0;
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    // Converte strings de data de volta para objetos Date
    if (parsed.transactions) {
      parsed.transactions.forEach(t => {
        if (t.date) t.date = new Date(t.date);
      });
    }
    if (parsed.ledgerEntries) {
      parsed.ledgerEntries.forEach(e => {
        if (e.date) e.date = new Date(e.date);
      });
    }
    Object.assign(state, parsed);
  } catch (error) {
    console.error('Falha ao carregar estado', error);
  }
}

function formatMoney(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: state.currency || 'BRL',
  }).format(value);
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const cleaned = value.toString().trim();
  
  // Formato OFX/ISO Compacto: YYYYMMDD
  if (/^\d{8}/.test(cleaned)) {
    const year = cleaned.slice(0, 4);
    const month = cleaned.slice(4, 6);
    const day = cleaned.slice(6, 8);
    const parsed = new Date(`${year}-${month}-${day}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  
  const parsed = new Date(cleaned);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseCSV(content) {
  const rows = [];
  let current = '';
  let inQuotes = false;
  let values = [];
  
  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    if (char === '"') {
      if (content[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (current || values.length) {
        values.push(current);
        rows.push(values);
        values = [];
        current = '';
      }
    } else {
      current += char;
    }
  }
  if (current || values.length) {
    values.push(current);
    rows.push(values);
  }
  return rows.map(row => row.map(item => item.trim()));
}

function parseOFX(content) {
  const transactions = [];
  const stmt = content.split('<STMTTRN>').slice(1);
  stmt.forEach((block) => {
    const getTag = (tag) => {
      const match = block.match(new RegExp(`<${tag}>([^<\r\n]+)`));
      return match ? match[1].trim() : '';
    };
    const date = parseDate(getTag('DTPOSTED'));
    const amount = parseAmount(getTag('TRNAMT'), true);
    const memo = getTag('MEMO') || getTag('NAME');
    transactions.push({
      date,
      description: memo,
      debit: amount < 0 ? Math.abs(amount) : 0,
      credit: amount > 0 ? amount : 0,
      balance: null,
      raw: block,
    });
  });
  return transactions;
}

function normalizeTransactions(rows) {
  if (!rows.length) return [];
  const header = rows[0].map(cell => cell.toLowerCase());
  const hasHeader = header.some(cell => ['data', 'date', 'descricao', 'historico', 'valor'].includes(cell));
  const startIndex = hasHeader ? 1 : 0;
  
  const indexOf = (names) => header.findIndex(cell => names.includes(cell));
  
  const dateIdx = indexOf(['data', 'date']);
  const descIdx = indexOf(['descricao', 'histórico', 'historico', 'memo']);
  const debitIdx = indexOf(['debito', 'débito']);
  const creditIdx = indexOf(['credito', 'crédito']);
  const valueIdx = indexOf(['valor', 'amount']);
  const balanceIdx = indexOf(['saldo', 'balance']);

  return rows.slice(startIndex).filter(row => row.length > 1).map((row) => {
    const date = parseDate(row[dateIdx >= 0 ? dateIdx : 0]);
    const description = row[descIdx >= 0 ? descIdx : 1] || '';
    
    const debit = debitIdx >= 0 ? parseAmount(row[debitIdx]) : 0;
    const credit = creditIdx >= 0 ? parseAmount(row[creditIdx]) : 0;
    let value = valueIdx >= 0 ? parseAmount(row[valueIdx]) : 0;

    if (value === 0 && (debit !== 0 || credit !== 0)) {
      value = credit !== 0 ? credit : -debit;
    }

    return {
      date,
      description,
      debit: debit || (value < 0 ? Math.abs(value) : 0),
      credit: credit || (value > 0 ? value : 0),
      balance: balanceIdx >= 0 ? parseAmount(row[balanceIdx]) : null,
      raw: row,
    };
  });
}

function applyRules(transaction) {
  for (const rule of state.rules) {
    try {
      const regex = new RegExp(rule.pattern, 'i');
      if (regex.test(transaction.description)) {
        return rule.account;
      }
    } catch (e) {
      console.warn('Regra inválida:', rule.pattern);
    }
  }
  return '';
}

function updateTransactions(newTransactions) {
  const updated = newTransactions.map((item) => ({
    ...item,
    id: generateId(),
    status: 'pending',
    account: applyRules(item),
  }));
  state.transactions = state.transactions.concat(updated);
  saveState();
  renderTransactions();
  renderSummary();
}

function renderSummary() {
  const total = state.transactions.length;
  const matched = state.transactions.filter(item => item.status === 'matched').length;
  elements.importSummary.textContent = `Total de transações: ${total}. Conciliadas: ${matched}. Pendentes: ${total - matched}.`;
}

function renderTransactions() {
  elements.transactionsTable.innerHTML = '';
  const term = elements.searchTransactions.value.toLowerCase();
  const filter = elements.filterStatus.value;
  
  const filtered = state.transactions.filter((item) => {
    const text = `${item.description} ${item.account}`.toLowerCase();
    const matchesTerm = text.includes(term);
    const matchesStatus = filter === 'all' || item.status === filter;
    return matchesTerm && matchesStatus;
  });

  const template = document.querySelector('#transaction-row-template');
  filtered.forEach((transaction) => {
    const row = template.content.cloneNode(true);
    const tr = row.querySelector('tr');
    
    row.querySelector('[data-field="date"]').textContent = transaction.date ? transaction.date.toLocaleDateString('pt-BR') : '-';
    row.querySelector('[data-field="description"]').textContent = transaction.description || '-';
    row.querySelector('[data-field="debit"]').textContent = transaction.debit ? formatMoney(transaction.debit) : '-';
    row.querySelector('[data-field="credit"]').textContent = transaction.credit ? formatMoney(transaction.credit) : '-';
    row.querySelector('[data-field="balance"]').textContent = transaction.balance ? formatMoney(transaction.balance) : '-';
    
    const statusCell = row.querySelector('[data-field="status"]');
    statusCell.innerHTML = transaction.status === 'matched'
      ? '<span class="status-pill status-matched">Conciliado</span>'
      : '<span class="status-pill status-pending">Pendente</span>';

    const accountInput = row.querySelector('.account-input');
    accountInput.value = transaction.account || '';
    
    accountInput.addEventListener('change', (event) => {
      transaction.account = event.target.value;
      transaction.status = transaction.account ? 'matched' : 'pending';
      if (transaction.account && transaction.description) {
        learnRule(transaction.description, transaction.account);
      }
      saveState();
      renderTransactions();
      renderSummary();
    });
    
    elements.transactionsTable.appendChild(row);
  });
}

function renderAccounts() {
  elements.accountsList.innerHTML = '';
  state.accounts.forEach((account, index) => {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = account;
    const remove = document.createElement('button');
    remove.textContent = '×';
    remove.onclick = () => {
      state.accounts.splice(index, 1);
      saveState();
      renderAccounts();
    };
    tag.appendChild(remove);
    elements.accountsList.appendChild(tag);
  });
}

function learnRule(description, account) {
  const existing = state.rules.find(r => r.pattern === description);
  if (existing) return;
  
  const pattern = description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  state.rules.unshift({ pattern, account, createdAt: new Date().toISOString() });
  saveState();
  renderRules();
}

function renderRules() {
  elements.rulesList.innerHTML = '';
  state.rules.forEach((rule, index) => {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = `${rule.pattern} → ${rule.account}`;
    const remove = document.createElement('button');
    remove.textContent = '×';
    remove.onclick = () => {
      state.rules.splice(index, 1);
      saveState();
      renderRules();
    };
    tag.appendChild(remove);
    elements.rulesList.appendChild(tag);
  });
}

function parseFiles(files) {
  const tasks = Array.from(files).map(file => file.text().then(content => ({ file, content })));
  Promise.all(tasks).then(results => {
    const parsed = [];
    results.forEach(({ file, content }) => {
      const name = file.name.toLowerCase();
      if (name.endsWith('.ofx')) {
        parsed.push(...parseOFX(content));
      } else if (name.endsWith('.json')) {
        try {
          const data = JSON.parse(content);
          const list = Array.isArray(data) ? data : [data];
          parsed.push(...list.map(item => ({
            date: parseDate(item.date || item.data),
            description: item.description || item.historico,
            debit: parseAmount(item.debit),
            credit: parseAmount(item.credit),
            balance: parseAmount(item.balance),
          })));
        } catch (e) { console.error("Erro JSON:", e); }
      } else {
        parsed.push(...normalizeTransactions(parseCSV(content)));
      }
    });
    updateTransactions(parsed);
  });
}

function handleAccountsImport(file) {
  if (!file) return;
  file.text().then(content => {
    const rows = parseCSV(content);
    rows.slice(1).forEach(row => {
      if (row[0] && row[1]) state.accounts.push(`${row[0]} - ${row[1]}`);
    });
    state.accounts = [...new Set(state.accounts)]; // Remove duplicados
    saveState();
    renderAccounts();
  });
}

function reconcile() {
  const days = parseInt(elements.toleranceDays.value, 10) || 0;
  const valTol = parseFloat(elements.toleranceValue.value) || 0;
  const matches = [];
  const remainingLedger = [...state.ledgerEntries];

  state.transactions.forEach(bankEntry => {
    if (bankEntry.status === 'matched') return;
    
    const bankVal = bankEntry.credit - bankEntry.debit;
    let matchIdx = -1;
    let minDiff = Infinity;

    remainingLedger.forEach((ledger, idx) => {
      const diffDays = bankEntry.date && ledger.date ? 
        Math.abs((bankEntry.date - ledger.date) / 86400000) : 999;
      const diffVal = Math.abs(bankVal - ledger.value);

      if (diffDays <= days && diffVal <= valTol && diffVal < minDiff) {
        matchIdx = idx;
        minDiff = diffVal;
      }
    });

    if (matchIdx >= 0) {
      const ledger = remainingLedger.splice(matchIdx, 1)[0];
      bankEntry.status = 'matched';
      bankEntry.account = ledger.account;
      matches.push({ bankEntry, ledger, diff: minDiff });
    }
  });

  saveState();
  renderTransactions();
  renderSummary();
  renderReconciliation(matches, remainingLedger);
}

function renderReconciliation(matches, remaining) {
  elements.reconciliationTable.innerHTML = '';
  matches.forEach(m => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${m.bankEntry.description} (${formatMoney(m.bankEntry.credit - m.bankEntry.debit)})</td>
      <td>${m.ledger.description} (${formatMoney(m.ledger.value)})</td>
      <td>${formatMoney(m.diff)}</td>
      <td><button class="secondary" onclick="this.closest('tr').remove()">Ok</button></td>
    `;
    elements.reconciliationTable.appendChild(row);
  });
  elements.reconciliationSummary.textContent = `Conciliados: ${matches.length}. Pendentes: ${remaining.length}.`;
}

function handleLedgerImport(file) {
  if (!file) return;
  file.text().then(content => {
    const rows = parseCSV(content);
    state.ledgerEntries = rows.slice(1).map(row => ({
      date: parseDate(row[0]),
      description: row[1],
      value: parseAmount(row[2]),
      account: row[3],
    })).filter(e => e.description);
    saveState();
  });
}

function exportData(type) {
  const data = state.transactions.map(t => ({
    ...t,
    date: t.date ? t.date.toISOString().split('T')[0] : ''
  }));
  
  if (type === 'json') {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'extrato-unificado.json'; a.click();
  } else {
    const csv = 'data,descricao,debito,credito,conta,status\n' + 
      data.map(t => `${t.date},"${t.description}",${t.debit},${t.credit},"${t.account}",${t.status}`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'extrato-unificado.csv'; a.click();
  }
}

function init() {
  loadState();
  renderAccounts();
  renderRules();
  renderTransactions();
  renderSummary();

  elements.parseFiles.onclick = () => {
    if (elements.fileInput.files.length) {
      state.currency = elements.currency.value;
      parseFiles(elements.fileInput.files);
    }
  };

  elements.addAccount.onclick = () => {
    const val = elements.newAccount.value.trim();
    if (val) {
      state.accounts.push(val);
      elements.newAccount.value = '';
      saveState(); renderAccounts();
    }
  };

  elements.addRule.onclick = () => {
    const p = elements.rulePattern.value.trim();
    const a = elements.ruleAccount.value.trim();
    if (p && a) {
      state.rules.unshift({ pattern: p, account: a });
      saveState(); renderRules();
      elements.rulePattern.value = ''; elements.ruleAccount.value = '';
    }
  };

  elements.resetData.onclick = () => {
    if(confirm("Limpar todos os dados?")) {
      localStorage.removeItem(storageKey);
      location.reload();
    }
  };

  elements.runReconciliation.onclick = reconcile;
  elements.searchTransactions.oninput = renderTransactions;
  elements.filterStatus.onchange = renderTransactions;
  elements.exportCsv.onclick = () => exportData('csv');
  elements.exportJson.onclick = () => exportData('json');
  elements.accountsFile.onchange = e => handleAccountsImport(e.target.files[0]);
  elements.ledgerInput.onchange = e => handleLedgerImport(e.target.files[0]);
}

init();
