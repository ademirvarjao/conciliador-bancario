/**
 * APP: Conciliador Bancário Pro
 * Melhorias: Dashboard, Seleção em Lote, Matching Inteligente
 */

const state = {
  transactions: [],
  accounts: [],
  rules: [],
  ledgerEntries: [],
  company: '',
  bank: '',
  pdfNotes: '',
  currency: 'BRL',
};

const storageKey = 'conciliador-bancario-v2';

// Seleção de elementos com cache
const $ = (selector) => document.querySelector(selector);
const elements = {
  fileInput: $('#file-input'),
  parseFiles: $('#parse-files'),
  importSummary: $('#import-summary'),
  accountsFile: $('#accounts-file'),
  addAccount: $('#add-account'),
  newAccount: $('#new-account'),
  accountsList: $('#accounts-list'),
  transactionsTable: $('#transactions-table tbody'),
  searchTransactions: $('#search-transactions'),
  filterStatus: $('#filter-status'),
  ledgerInput: $('#ledger-input'),
  toleranceDays: $('#tolerance-days'),
  toleranceValue: $('#tolerance-value'),
  runReconciliation: $('#run-reconciliation'),
  reconciliationSummary: $('#reconciliation-summary'),
  exportCsv: $('#export-csv'),
  exportJson: $('#export-json'),
  loadSamples: $('#load-samples'),
  resetData: $('#reset-data'),
  companyName: $('#company-name'),
  bankName: $('#bank-name'),
  pdfNotes: $('#pdf-notes'),
  selectAll: $('#select-all'),
  bulkActions: $('#bulk-actions'),
  selectedCount: $('#selected-count'),
  bulkAccount: $('#bulk-account-select'),
  bulkDelete: $('#bulk-delete'),
  statCredits: $('#stat-credits'),
  statDebits: $('#stat-debits'),
  statBalance: $('#stat-balance'),
  statReconciled: $('#stat-reconciled-pct')
};

// --- Utilitários de Dados ---

function formatCurrency(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: state.currency }).format(val);
}

function parseAmount(value, isOFX = false) {
  if (!value) return 0;
  let str = value.toString().trim().replace(/\s/g, '');
  
  // Trata formato contábil (100.00)
  if (isOFX) return parseFloat(str) || 0;

  // Detecção de formato BR vs EN
  if (str.includes(',') && str.includes('.')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.'); // BR
    } else {
      str = str.replace(/,/g, ''); // EN
    }
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  
  return parseFloat(str) || 0;
}

function parseDate(val) {
  if (!val) return null;
  const s = val.toString().trim();
  // YYYYMMDD (OFX)
  if (/^\d{8}/.test(s)) {
    return new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T12:00:00`);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// --- Persistência ---

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
  renderDashboard();
}

function loadState() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    // Hidrata datas
    if (parsed.transactions) parsed.transactions.forEach(t => t.date = parseDate(t.date));
    if (parsed.ledgerEntries) parsed.ledgerEntries.forEach(e => e.date = parseDate(e.date));
    Object.assign(state, parsed);
    updateUI();
  } catch (e) { console.error("Erro ao carregar estado", e); }
}

// --- Parsers ---

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const delimiter = lines[0].includes(';') ? ';' : ',';
  
  return lines.map(line => {
    const parts = [];
    let current = '', inQuotes = false;
    for (let char of line) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === delimiter && !inQuotes) { parts.push(current.trim()); current = ''; }
      else current += char;
    }
    parts.push(current.trim());
    return parts;
  });
}

function processUploadedFiles(files) {
  let allNew = [];
  const promises = Array.from(files).map(file => {
    return file.text().then(text => {
      if (file.name.toLowerCase().endsWith('.ofx')) {
        const matches = text.split('<STMTTRN>').slice(1);
        matches.forEach(block => {
          const getTag = (tag) => (block.match(new RegExp(`<${tag}>([^<\\r\\n]+)`)) || [])[1]?.trim() || '';
          const amt = parseAmount(getTag('TRNAMT'), true);
          allNew.push({
            date: parseDate(getTag('DTPOSTED')),
            description: getTag('MEMO') || getTag('NAME'),
            amount: amt,
            status: 'pending'
          });
        });
      } else {
        const rows = parseCSV(text);
        rows.slice(1).forEach(r => {
          if (r.length < 2) return;
          allNew.push({
            date: parseDate(r[0]),
            description: r[1],
            amount: parseAmount(r[2]),
            status: 'pending'
          });
        });
      }
    });
  });

  Promise.all(promises).then(() => {
    state.transactions = [...state.transactions, ...allNew.map(t => ({...t, id: crypto.randomUUID(), account: suggestAccount(t)}))];
    saveState();
    renderTransactions();
  });
}

// --- Lógica de Negócio ---

function suggestAccount(transaction) {
  const match = state.rules.find(r => new RegExp(r.pattern, 'i').test(transaction.description));
  return match ? match.account : '';
}

function renderDashboard() {
  const credits = state.transactions.reduce((acc, t) => t.amount > 0 ? acc + t.amount : acc, 0);
  const debits = state.transactions.reduce((acc, t) => t.amount < 0 ? acc + t.amount : acc, 0);
  const reconciled = state.transactions.filter(t => t.status === 'matched').length;
  const total = state.transactions.length;

  elements.statCredits.textContent = formatCurrency(credits);
  elements.statDebits.textContent = formatCurrency(Math.abs(debits));
  elements.statBalance.textContent = formatCurrency(credits + debits);
  elements.statReconciled.textContent = total ? `${Math.round((reconciled/total)*100)}%` : '0%';
}

function renderTransactions() {
  elements.transactionsTable.innerHTML = '';
  const term = elements.searchTransactions.value.toLowerCase();
  const filter = elements.filterStatus.value;

  const filtered = state.transactions.filter(t => {
    const matchesTerm = t.description.toLowerCase().includes(term) || (t.account || '').toLowerCase().includes(term);
    const matchesStatus = filter === 'all' || t.status === filter;
    return matchesTerm && matchesStatus;
  });

  const template = $('#transaction-row-template');
  filtered.forEach(t => {
    const row = template.content.cloneNode(true);
    const tr = row.querySelector('tr');
    tr.dataset.id = t.id;

    row.querySelector('[data-field="date"]').textContent = t.date ? t.date.toLocaleDateString('pt-BR') : '-';
    row.querySelector('[data-field="description"]').textContent = t.description;
    
    const amtEl = row.querySelector('[data-field="amount"]');
    amtEl.textContent = formatCurrency(t.amount);
    amtEl.className = t.amount >= 0 ? 'text-success' : 'text-danger';

    const picker = row.querySelector('.account-picker');
    picker.innerHTML = `<option value="">Selecionar...</option>` + 
      state.accounts.map(acc => `<option value="${acc}" ${t.account === acc ? 'selected' : ''}>${acc}</option>`).join('');
    
    picker.onchange = (e) => {
      t.account = e.target.value;
      // Cria regra automática se não existir
      if (t.account && !state.rules.some(r => r.pattern === t.description)) {
        state.rules.push({ pattern: t.description, account: t.account });
      }
      saveState();
    };

    const statusEl = row.querySelector('[data-field="status"]');
    statusEl.textContent = t.status === 'matched' ? 'Conciliado' : 'Pendente';
    statusEl.className = `status-badge status-${t.status}`;

    elements.transactionsTable.appendChild(row);
  });
  updateBulkToolbar();
}

// --- Ações em Lote ---

function updateBulkToolbar() {
  const checked = document.querySelectorAll('.row-checkbox:checked').length;
  elements.bulkActions.classList.toggle('hidden', checked === 0);
  elements.selectedCount.textContent = `${checked} itens selecionados`;
}

function handleBulkAccount(acc) {
  const selectedIds = Array.from(document.querySelectorAll('.row-checkbox:checked')).map(cb => cb.closest('tr').dataset.id);
  state.transactions.forEach(t => {
    if (selectedIds.includes(t.id)) t.account = acc;
  });
  saveState(); renderTransactions();
}

// --- Conciliação (Matching) ---

function runMatching() {
  const daysTol = parseInt(elements.toleranceDays.value);
  const valTol = parseFloat(elements.toleranceValue.value);
  let matchCount = 0;

  state.transactions.forEach(bank => {
    if (bank.status === 'matched') return;

    const match = state.ledgerEntries.find(ledger => {
      const diffDays = Math.abs((bank.date - ledger.date) / 86400000);
      const diffVal = Math.abs(bank.amount - ledger.value);
      return diffDays <= daysTol && diffVal <= valTol;
    });

    if (match) {
      bank.status = 'matched';
      bank.account = match.account;
      matchCount++;
    }
  });

  elements.reconciliationSummary.textContent = `Sucesso! ${matchCount} novas conciliações encontradas.`;
  elements.reconciliationSummary.classList.remove('hidden');
  saveState(); renderTransactions();
}

// --- Inicialização ---

function updateUI() {
  elements.companyName.value = state.company;
  elements.bankName.value = state.bank;
  elements.pdfNotes.value = state.pdfNotes;
  
  // Renderiza contas
  elements.accountsList.innerHTML = state.accounts.map(acc => `<span class="tag">${acc} <button onclick="removeAccount('${acc}')">&times;</button></span>`).join('');
  elements.bulkAccount.innerHTML = `<option value="">Aplicar Conta...</option>` + state.accounts.map(acc => `<option value="${acc}">${acc}</option>`).join('');
  
  renderTransactions();
  renderDashboard();
}

window.removeAccount = (acc) => {
  state.accounts = state.accounts.filter(a => a !== acc);
  saveState(); updateUI();
};

function init() {
  loadState();

  elements.parseFiles.onclick = () => processUploadedFiles(elements.fileInput.files);
  elements.addAccount.onclick = () => {
    const val = elements.newAccount.value.trim();
    if (val) { state.accounts.push(val); elements.newAccount.value = ''; saveState(); updateUI(); }
  };

  elements.selectAll.onchange = (e) => {
    document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = e.target.checked);
    updateBulkToolbar();
  };

  elements.transactionsTable.onclick = (e) => {
    if (e.target.classList.contains('row-checkbox')) updateBulkToolbar();
  };

  elements.bulkAccount.onchange = (e) => { if(e.target.value) handleBulkAccount(e.target.value); };
  
  elements.bulkDelete.onclick = () => {
    if(!confirm("Excluir transações selecionadas?")) return;
    const selectedIds = Array.from(document.querySelectorAll('.row-checkbox:checked')).map(cb => cb.closest('tr').dataset.id);
    state.transactions = state.transactions.filter(t => !selectedIds.includes(t.id));
    saveState(); renderTransactions();
  };

  elements.runReconciliation.onclick = runMatching;
  elements.searchTransactions.oninput = renderTransactions;
  elements.filterStatus.onchange = renderTransactions;
  
  elements.companyName.oninput = (e) => { state.company = e.target.value; saveState(); };
  elements.bankName.oninput = (e) => { state.bank = e.target.value; saveState(); };
  elements.pdfNotes.oninput = (e) => { state.pdfNotes = e.target.value; saveState(); };

  elements.resetData.onclick = () => { if(confirm("Limpar todos os dados permanentemente?")) { localStorage.clear(); location.reload(); } };
}

init();
