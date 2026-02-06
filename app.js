/**
 * CONCILIADOR BANCÁRIO v0.5
 * 
 * @description Ferramenta open source de conciliação bancária automática
 * @author Ademir Varjão
 * @license MIT
 * @version 0.5.0
 * @year 2026
 * 
 * Funcionalidades v0.5:
 * - Matching inteligente com tolerância configurável
 * - Validação robusta de dados
 * - Ações em lote otimizadas
 * - Performance para grandes volumes
 * - Sistema de regras automáticas aprimorado
 * - Dashboard com métricas em tempo real
 */

'use strict';

// ============================================
// ESTADO DA APLICAÇÃO
// ============================================

const state = {
  transactions: [],
  accounts: [],
  rules: [],
  ledgerEntries: [],
  company: '',
  bank: '',
  pdfNotes: '',
  currency: 'BRL',
  version: '0.5.0',
  lastUpdate: null
};

const CONFIG = {
  storageKey: 'conciliador-bancario-v2',
  maxTransactions: 50000,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  defaultToleranceDays: 2,
  defaultToleranceValue: 0.05,
  autoSaveDelay: 500
};

// ============================================
// CACHE DE ELEMENTOS DOM
// ============================================

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const elements = {
  fileInput: $('#file-input'),
  dropZone: $('#drop-zone'),
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

// ============================================
// UTILITÁRIOS DE FORMATAÇÃO
// ============================================

const formatCurrency = (val) => {
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: state.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val || 0);
};

const formatDate = (date) => {
  if (!date || !(date instanceof Date)) return '-';
  return date.toLocaleDateString('pt-BR');
};

const formatPercent = (val) => {
  return `${Math.round(val * 100)}%`;
};

// ============================================
// PARSERS E CONVERSORES
// ============================================

function parseAmount(value, isOFX = false) {
  if (!value) return 0;
  
  let str = value.toString().trim().replace(/\s/g, '');
  
  // Formato OFX: sempre ponto decimal
  if (isOFX) {
    return parseFloat(str) || 0;
  }
  
  // Remove símbolos monetários
  str = str.replace(/[R$\u20ac\xa3\xa5]/g, '');
  
  // Detecta formato BR vs EN
  const hasComma = str.includes(',');
  const hasDot = str.includes('.');
  
  if (hasComma && hasDot) {
    // Tem ambos - verifica qual é o separador decimal
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    
    if (lastComma > lastDot) {
      // Formato BR: 1.234,56
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato EN: 1,234.56
      str = str.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Só tem vírgula - assume BR
    str = str.replace(',', '.');
  }
  
  const result = parseFloat(str);
  return isNaN(result) ? 0 : result;
}

function parseDate(val) {
  if (!val) return null;
  
  const s = val.toString().trim();
  
  // YYYYMMDD (formato OFX)
  if (/^\d{8}$/.test(s)) {
    const year = s.slice(0, 4);
    const month = s.slice(4, 6);
    const day = s.slice(6, 8);
    return new Date(`${year}-${month}-${day}T12:00:00`);
  }
  
  // DD/MM/YYYY ou DD-MM-YYYY (formato BR)
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(s)) {
    const [day, month, year] = s.split(/[\/\-]/);
    return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00`);
  }
  
  // Tenta ISO e outros formatos
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// ============================================
// VALIDAÇÃO DE DADOS
// ============================================

const validators = {
  isValidFile(file) {
    if (!file) return { valid: false, error: 'Nenhum arquivo fornecido' };
    if (file.size > CONFIG.maxFileSize) {
      return { valid: false, error: `Arquivo muito grande (máx: ${CONFIG.maxFileSize / 1024 / 1024}MB)` };
    }
    const validExtensions = ['.ofx', '.csv', '.json'];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!validExtensions.includes(ext)) {
      return { valid: false, error: 'Formato inválido. Use OFX, CSV ou JSON' };
    }
    return { valid: true };
  },
  
  isValidTransaction(t) {
    if (!t) return false;
    if (!t.description || t.description.trim() === '') return false;
    if (typeof t.amount !== 'number' || isNaN(t.amount)) return false;
    if (!t.date || !(t.date instanceof Date)) return false;
    return true;
  },
  
  sanitizeString(str) {
    if (!str) return '';
    return str.toString().trim().replace(/[<>"']/g, '');
  }
};

// ============================================
// PERSISTÊNCIA (LocalStorage)
// ============================================

let autoSaveTimer = null;

function saveState() {
  state.lastUpdate = new Date().toISOString();
  
  try {
    const serialized = JSON.stringify(state);
    localStorage.setItem(CONFIG.storageKey, serialized);
    renderDashboard();
    return true;
  } catch (e) {
    console.error('Erro ao salvar estado:', e);
    if (e.name === 'QuotaExceededError') {
      showNotification('Armazenamento cheio! Exporte seus dados e limpe os antigos.', 'error');
    }
    return false;
  }
}

function autoSave() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => saveState(), CONFIG.autoSaveDelay);
}

function loadState() {
  const raw = localStorage.getItem(CONFIG.storageKey);
  if (!raw) return false;
  
  try {
    const parsed = JSON.parse(raw);
    
    // Hidratação de datas
    if (parsed.transactions) {
      parsed.transactions.forEach(t => {
        t.date = t.date ? new Date(t.date) : null;
      });
    }
    
    if (parsed.ledgerEntries) {
      parsed.ledgerEntries.forEach(e => {
        e.date = e.date ? new Date(e.date) : null;
      });
    }
    
    // Migração de versão
    if (!parsed.version || parsed.version !== state.version) {
      console.log(`Migrando de v${parsed.version || 'legacy'} para v${state.version}`);
      parsed.version = state.version;
    }
    
    Object.assign(state, parsed);
    updateUI();
    return true;
  } catch (e) {
    console.error('Erro ao carregar estado:', e);
    return false;
  }
}

// ============================================
// PARSERS DE ARQUIVOS
// ============================================

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  
  // Detecta delimitador
  const firstLine = lines[0];
  const delimiter = firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';
  
  return lines.map(line => {
    const parts = [];
    let current = '';
    let inQuotes = false;
    
    for (let char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        parts.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    
    parts.push(current.trim().replace(/^"|"$/g, ''));
    return parts;
  });
}

function parseOFX(content) {
  const transactions = [];
  const blocks = content.split('<STMTTRN>').slice(1);
  
  blocks.forEach(block => {
    const getTag = (tag) => {
      const match = block.match(new RegExp(`<${tag}>([^<\\r\\n]+)`));
      return match ? match[1].trim() : '';
    };
    
    const date = parseDate(getTag('DTPOSTED'));
    const amount = parseAmount(getTag('TRNAMT'), true);
    const description = getTag('MEMO') || getTag('NAME') || 'Sem descrição';
    
    if (date && !isNaN(amount)) {
      transactions.push({
        date,
        description: validators.sanitizeString(description),
        amount,
        status: 'pending'
      });
    }
  });
  
  return transactions;
}

// ============================================
// PROCESSAMENTO DE UPLOAD
// ============================================

async function processUploadedFiles(files) {
  if (!files || files.length === 0) {
    showNotification('Nenhum arquivo selecionado', 'warning');
    return;
  }
  
  let allNew = [];
  let errors = [];
  
  elements.parseFiles.disabled = true;
  elements.parseFiles.textContent = 'Processando...';
  
  try {
    for (const file of files) {
      const validation = validators.isValidFile(file);
      if (!validation.valid) {
        errors.push(`${file.name}: ${validation.error}`);
        continue;
      }
      
      const text = await file.text();
      const fileName = file.name.toLowerCase();
      
      if (fileName.endsWith('.ofx')) {
        const parsed = parseOFX(text);
        allNew.push(...parsed);
      } else if (fileName.endsWith('.csv')) {
        const rows = parseCSV(text);
        
        // Pula cabeçalho
        rows.slice(1).forEach(r => {
          if (r.length < 3) return;
          
          const date = parseDate(r[0]);
          const description = validators.sanitizeString(r[1]);
          const amount = parseAmount(r[2]);
          
          if (date && description && !isNaN(amount)) {
            allNew.push({
              date,
              description,
              amount,
              status: 'pending'
            });
          }
        });
      } else if (fileName.endsWith('.json')) {
        try {
          const data = JSON.parse(text);
          if (Array.isArray(data)) {
            allNew.push(...data.filter(validators.isValidTransaction));
          }
        } catch (e) {
          errors.push(`${file.name}: JSON inválido`);
        }
      }
    }
    
    // Adiciona IDs únicos e sugere contas
    const withMetadata = allNew.map(t => ({
      ...t,
      id: crypto.randomUUID(),
      account: suggestAccount(t),
      importedAt: new Date().toISOString()
    }));
    
    // Previne duplicatas (mesma data, descrição e valor)
    const existing = new Set(
      state.transactions.map(t => `${t.date?.toISOString()}|${t.description}|${t.amount}`)
    );
    
    const uniqueNew = withMetadata.filter(t => {
      const key = `${t.date?.toISOString()}|${t.description}|${t.amount}`;
      return !existing.has(key);
    });
    
    state.transactions.push(...uniqueNew);
    
    // Ordena por data (mais recente primeiro)
    state.transactions.sort((a, b) => b.date - a.date);
    
    saveState();
    renderTransactions();
    
    // Notificação de sucesso
    const msg = `✅ ${uniqueNew.length} transações importadas com sucesso!`;
    const duplicates = allNew.length - uniqueNew.length;
    const fullMsg = duplicates > 0 ? `${msg} (${duplicates} duplicatas ignoradas)` : msg;
    
    showNotification(fullMsg, 'success');
    elements.importSummary.textContent = fullMsg;
    elements.importSummary.classList.remove('hidden');
    
    if (errors.length > 0) {
      console.warn('Erros durante importação:', errors);
      showNotification(`${errors.length} arquivo(s) com erro`, 'warning');
    }
    
  } catch (e) {
    console.error('Erro no processamento:', e);
    showNotification('Erro ao processar arquivos', 'error');
  } finally {
    elements.parseFiles.disabled = false;
    elements.parseFiles.textContent = 'Processar Arquivos';
    elements.fileInput.value = ''; // Limpa input
  }
}

// ============================================
// LÓGICA DE NEGÓCIO
// ============================================

function suggestAccount(transaction) {
  if (!transaction || !transaction.description) return '';
  
  const desc = transaction.description.toLowerCase();
  
  // Busca regra exata
  const exactMatch = state.rules.find(r => {
    try {
      const regex = new RegExp(r.pattern, 'i');
      return regex.test(transaction.description);
    } catch {
      return false;
    }
  });
  
  if (exactMatch) return exactMatch.account;
  
  // Busca parcial (fallback)
  const partialMatch = state.rules.find(r => {
    const pattern = r.pattern.toLowerCase();
    return desc.includes(pattern) || pattern.includes(desc);
  });
  
  return partialMatch ? partialMatch.account : '';
}

function createRule(description, account) {
  if (!description || !account) return;
  
  // Evita duplicatas
  const exists = state.rules.some(r => r.pattern === description && r.account === account);
  if (exists) return;
  
  state.rules.push({
    pattern: description,
    account: account,
    createdAt: new Date().toISOString(),
    usageCount: 0
  });
  
  autoSave();
}

// ============================================
// DASHBOARD E MÉTRICAS
// ============================================

function calculateMetrics() {
  const metrics = {
    credits: 0,
    debits: 0,
    balance: 0,
    total: state.transactions.length,
    reconciled: 0,
    pending: 0,
    reconciledPct: 0
  };
  
  state.transactions.forEach(t => {
    if (t.amount > 0) {
      metrics.credits += t.amount;
    } else {
      metrics.debits += Math.abs(t.amount);
    }
    
    if (t.status === 'matched') {
      metrics.reconciled++;
    } else {
      metrics.pending++;
    }
  });
  
  metrics.balance = metrics.credits - metrics.debits;
  metrics.reconciledPct = metrics.total > 0 ? metrics.reconciled / metrics.total : 0;
  
  return metrics;
}

function renderDashboard() {
  const metrics = calculateMetrics();
  
  elements.statCredits.textContent = formatCurrency(metrics.credits);
  elements.statDebits.textContent = formatCurrency(metrics.debits);
  elements.statBalance.textContent = formatCurrency(metrics.balance);
  elements.statBalance.className = metrics.balance >= 0 ? 'stat-value text-success' : 'stat-value text-danger';
  elements.statReconciled.textContent = formatPercent(metrics.reconciledPct);
}

// ============================================
// RENDERIZAÇÃO DE TRANSAÇÕES
// ============================================

function renderTransactions() {
  const term = elements.searchTransactions.value.toLowerCase();
  const filter = elements.filterStatus.value;
  
  const filtered = state.transactions.filter(t => {
    const matchesTerm = !term || 
      t.description.toLowerCase().includes(term) || 
      (t.account || '').toLowerCase().includes(term);
    
    const matchesStatus = filter === 'all' || t.status === filter;
    
    return matchesTerm && matchesStatus;
  });
  
  elements.transactionsTable.innerHTML = '';
  
  if (filtered.length === 0) {
    elements.transactionsTable.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #94a3b8;">Nenhuma transação encontrada</td></tr>';
    return;
  }
  
  const template = $('#transaction-row-template');
  const fragment = document.createDocumentFragment();
  
  filtered.forEach(t => {
    const row = template.content.cloneNode(true);
    const tr = row.querySelector('tr');
    tr.dataset.id = t.id;
    
    row.querySelector('[data-field="date"]').textContent = formatDate(t.date);
    row.querySelector('[data-field="description"]').textContent = t.description;
    row.querySelector('[data-field="description"]').title = t.description; // Tooltip
    
    const amtEl = row.querySelector('[data-field="amount"]');
    amtEl.textContent = formatCurrency(t.amount);
    amtEl.className = `text-right font-medium ${t.amount >= 0 ? 'text-success' : 'text-danger'}`;
    
    const picker = row.querySelector('.account-picker');
    picker.innerHTML = `<option value="">Selecionar...</option>` + 
      state.accounts.map(acc => 
        `<option value="${acc}" ${t.account === acc ? 'selected' : ''}>${acc}</option>`
      ).join('');
    
    picker.onchange = (e) => {
      const oldAccount = t.account;
      t.account = e.target.value;
      
      // Cria regra automática
      if (t.account && oldAccount !== t.account) {
        createRule(t.description, t.account);
      }
      
      autoSave();
    };
    
    const statusEl = row.querySelector('[data-field="status"]');
    statusEl.textContent = t.status === 'matched' ? '✅ Conciliado' : '⌛ Pendente';
    statusEl.className = `status-badge status-${t.status}`;
    
    fragment.appendChild(row);
  });
  
  elements.transactionsTable.appendChild(fragment);
  updateBulkToolbar();
}

// ============================================
// AÇÕES EM LOTE
// ============================================

function getSelectedTransactions() {
  return Array.from($$('.row-checkbox:checked')).map(cb => {
    const tr = cb.closest('tr');
    return state.transactions.find(t => t.id === tr.dataset.id);
  }).filter(Boolean);
}

function updateBulkToolbar() {
  const selected = getSelectedTransactions();
  const count = selected.length;
  
  elements.bulkActions.classList.toggle('hidden', count === 0);
  elements.selectedCount.textContent = `${count} ${count === 1 ? 'item selecionado' : 'itens selecionados'}`;
}

function handleBulkAccount(accountName) {
  if (!accountName) return;
  
  const selected = getSelectedTransactions();
  selected.forEach(t => {
    t.account = accountName;
    createRule(t.description, accountName);
  });
  
  saveState();
  renderTransactions();
  showNotification(`✅ Conta "${accountName}" aplicada a ${selected.length} transações`, 'success');
  
  // Reseta seleção
  elements.selectAll.checked = false;
  elements.bulkAccount.value = '';
}

function handleBulkDelete() {
  const selected = getSelectedTransactions();
  if (selected.length === 0) return;
  
  const confirmed = confirm(`Tem certeza que deseja excluir ${selected.length} transação(ões)?\n\nEsta ação não pode ser desfeita.`);
  if (!confirmed) return;
  
  const selectedIds = new Set(selected.map(t => t.id));
  state.transactions = state.transactions.filter(t => !selectedIds.has(t.id));
  
  saveState();
  renderTransactions();
  showNotification(`🗑️ ${selected.length} transação(ões) excluída(s)`, 'success');
  
  elements.selectAll.checked = false;
}

// ============================================
// CONCILIAÇÃO (MATCHING)
// ============================================

function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  // Levenshtein distance simplificado
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = longer.split('').reduce((acc, char, i) => {
    return acc + (shorter[i] !== char ? 1 : 0);
  }, 0);
  
  return (longer.length - editDistance) / longer.length;
}

function runMatching() {
  if (state.ledgerEntries.length === 0) {
    showNotification('⚠️ Carregue primeiro o arquivo de Razão Contábil', 'warning');
    return;
  }
  
  const daysTol = parseInt(elements.toleranceDays.value) || CONFIG.defaultToleranceDays;
  const valTol = parseFloat(elements.toleranceValue.value) || CONFIG.defaultToleranceValue;
  
  elements.runReconciliation.disabled = true;
  elements.runReconciliation.textContent = 'Processando...';
  
  let matchCount = 0;
  const matches = [];
  
  try {
    state.transactions.forEach(bank => {
      if (bank.status === 'matched') return;
      
      let bestMatch = null;
      let bestScore = 0;
      
      state.ledgerEntries.forEach(ledger => {
        if (ledger.matched) return; // Já foi conciliado
        
        // 1. Verifica diferença de data
        const diffDays = Math.abs((bank.date - ledger.date) / 86400000);
        if (diffDays > daysTol) return;
        
        // 2. Verifica diferença de valor
        const diffVal = Math.abs(bank.amount - ledger.value);
        if (diffVal > valTol) return;
        
        // 3. Calcula score de similaridade
        const dateSimilarity = 1 - (diffDays / daysTol);
        const valueSimilarity = 1 - (diffVal / valTol);
        const descSimilarity = calculateSimilarity(bank.description, ledger.description || '');
        
        const score = (dateSimilarity * 0.3) + (valueSimilarity * 0.5) + (descSimilarity * 0.2);
        
        if (score > bestScore && score > 0.7) {
          bestScore = score;
          bestMatch = ledger;
        }
      });
      
      if (bestMatch) {
        bank.status = 'matched';
        bank.account = bestMatch.account || bank.account;
        bank.matchedWith = bestMatch.id;
        bank.matchScore = bestScore;
        bestMatch.matched = true;
        matches.push({ bank, ledger: bestMatch, score: bestScore });
        matchCount++;
      }
    });
    
    saveState();
    renderTransactions();
    
    const msg = `🎯 ${matchCount} conciliação(ões) automática(s) realizada(s) com sucesso!`;
    showNotification(msg, 'success');
    
    elements.reconciliationSummary.textContent = msg;
    elements.reconciliationSummary.className = 'alert alert-success mt-2';
    elements.reconciliationSummary.classList.remove('hidden');
    
    console.log('Matches encontrados:', matches);
    
  } catch (e) {
    console.error('Erro na conciliação:', e);
    showNotification('Erro ao executar matching', 'error');
  } finally {
    elements.runReconciliation.disabled = false;
    elements.runReconciliation.textContent = 'Executar Matching';
  }
}

async function loadLedgerFile(file) {
  const validation = validators.isValidFile(file);
  if (!validation.valid) {
    showNotification(validation.error, 'error');
    return;
  }
  
  try {
    const text = await file.text();
    const rows = parseCSV(text);
    
    state.ledgerEntries = [];
    
    rows.slice(1).forEach(r => {
      if (r.length < 3) return;
      
      const date = parseDate(r[0]);
      const description = validators.sanitizeString(r[1]);
      const value = parseAmount(r[2]);
      const account = r[3] ? validators.sanitizeString(r[3]) : '';
      
      if (date && !isNaN(value)) {
        state.ledgerEntries.push({
          id: crypto.randomUUID(),
          date,
          description,
          value,
          account,
          matched: false
        });
      }
    });
    
    showNotification(`📊 ${state.ledgerEntries.length} lançamentos carregados do razão`, 'success');
    elements.runReconciliation.disabled = false;
    
  } catch (e) {
    console.error('Erro ao carregar razão:', e);
    showNotification('Erro ao processar arquivo de razão', 'error');
  }
}

// ============================================
// EXPORTAÇÃO
// ============================================

function exportToCSV() {
  if (state.transactions.length === 0) {
    showNotification('Nenhuma transação para exportar', 'warning');
    return;
  }
  
  const headers = ['Data', 'Descrição', 'Valor', 'Conta Contábil', 'Status'];
  const rows = state.transactions.map(t => [
    formatDate(t.date),
    `"${t.description}"`,
    t.amount.toFixed(2),
    `"${t.account || ''}"`,
    t.status === 'matched' ? 'Conciliado' : 'Pendente'
  ]);
  
  const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadFile(blob, `conciliacao_${Date.now()}.csv`);
  
  showNotification('💾 CSV exportado com sucesso!', 'success');
}

function exportToJSON() {
  if (state.transactions.length === 0) {
    showNotification('Nenhuma transação para exportar', 'warning');
    return;
  }
  
  const data = {
    version: state.version,
    exportDate: new Date().toISOString(),
    company: state.company,
    bank: state.bank,
    transactions: state.transactions,
    accounts: state.accounts,
    rules: state.rules,
    metrics: calculateMetrics()
  };
  
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  downloadFile(blob, `conciliacao_${Date.now()}.json`);
  
  showNotification('💾 JSON exportado com sucesso!', 'success');
}

function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================
// GERENCIAMENTO DE CONTAS
// ============================================

function addAccount(name) {
  const sanitized = validators.sanitizeString(name);
  if (!sanitized) return;
  
  if (state.accounts.includes(sanitized)) {
    showNotification('Esta conta já existe', 'warning');
    return;
  }
  
  state.accounts.push(sanitized);
  state.accounts.sort();
  autoSave();
  updateUI();
  
  showNotification(`✅ Conta "${sanitized}" adicionada`, 'success');
}

function removeAccount(name) {
  const confirmed = confirm(`Remover a conta "${name}"?\n\nAs transações que usam esta conta não serão afetadas.`);
  if (!confirmed) return;
  
  state.accounts = state.accounts.filter(a => a !== name);
  autoSave();
  updateUI();
  
  showNotification(`🗑️ Conta "${name}" removida`, 'success');
}

async function importAccountsFromCSV(file) {
  try {
    const text = await file.text();
    const rows = parseCSV(text);
    
    let imported = 0;
    rows.forEach(r => {
      const account = validators.sanitizeString(r[0]);
      if (account && !state.accounts.includes(account)) {
        state.accounts.push(account);
        imported++;
      }
    });
    
    state.accounts.sort();
    saveState();
    updateUI();
    
    showNotification(`📊 ${imported} conta(s) importada(s)`, 'success');
  } catch (e) {
    console.error('Erro ao importar contas:', e);
    showNotification('Erro ao importar contas', 'error');
  }
}

// ============================================
// UI E ATUALIZAÇÕES
// ============================================

function updateUI() {
  // Campos de metadados
  elements.companyName.value = state.company || '';
  elements.bankName.value = state.bank || '';
  elements.pdfNotes.value = state.pdfNotes || '';
  
  // Lista de contas
  elements.accountsList.innerHTML = state.accounts.length === 0
    ? '<p style="color: #94a3b8; text-align: center; padding: 20px;">Nenhuma conta cadastrada</p>'
    : state.accounts.map(acc => 
        `<span class="tag">${acc} <button onclick="removeAccount('${acc}')" title="Remover conta">&times;</button></span>`
      ).join('');
  
  // Dropdown de contas para bulk actions
  elements.bulkAccount.innerHTML = `<option value="">Aplicar Conta...</option>` + 
    state.accounts.map(acc => `<option value="${acc}">${acc}</option>`).join('');
  
  renderTransactions();
  renderDashboard();
}

function showNotification(message, type = 'info') {
  // Sistema simples de notificação (pode ser expandido)
  console.log(`[${type.toUpperCase()}]`, message);
  
  // TODO: Implementar toast notifications
}

// ============================================
// DRAG AND DROP
// ============================================

function setupDragAndDrop() {
  const dropZone = elements.dropZone;
  
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
  });
  
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.add('drag-over');
    });
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.remove('drag-over');
    });
  });
  
  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    elements.fileInput.files = files;
    processUploadedFiles(files);
  });
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Upload e processamento
  elements.fileInput.addEventListener('change', (e) => {
    processUploadedFiles(e.target.files);
  });
  
  elements.parseFiles.addEventListener('click', () => {
    if (elements.fileInput.files.length > 0) {
      processUploadedFiles(elements.fileInput.files);
    } else {
      elements.fileInput.click();
    }
  });
  
  // Contas
  elements.addAccount.addEventListener('click', () => {
    const val = elements.newAccount.value.trim();
    if (val) {
      addAccount(val);
      elements.newAccount.value = '';
    }
  });
  
  elements.newAccount.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      elements.addAccount.click();
    }
  });
  
  elements.accountsFile.addEventListener('change', (e) => {
    if (e.target.files[0]) {
      importAccountsFromCSV(e.target.files[0]);
      e.target.value = '';
    }
  });
  
  // Busca e filtros
  elements.searchTransactions.addEventListener('input', debounce(renderTransactions, 300));
  elements.filterStatus.addEventListener('change', renderTransactions);
  
  // Seleção em lote
  elements.selectAll.addEventListener('change', (e) => {
    $$('.row-checkbox').forEach(cb => {
      cb.checked = e.target.checked;
    });
    updateBulkToolbar();
  });
  
  elements.transactionsTable.addEventListener('change', (e) => {
    if (e.target.classList.contains('row-checkbox')) {
      updateBulkToolbar();
    }
  });
  
  elements.bulkAccount.addEventListener('change', (e) => {
    if (e.target.value) {
      handleBulkAccount(e.target.value);
    }
  });
  
  elements.bulkDelete.addEventListener('click', handleBulkDelete);
  
  // Conciliação
  elements.ledgerInput.addEventListener('change', (e) => {
    if (e.target.files[0]) {
      loadLedgerFile(e.target.files[0]);
    }
  });
  
  elements.runReconciliation.addEventListener('click', runMatching);
  
  // Exportação
  elements.exportCsv.addEventListener('click', exportToCSV);
  elements.exportJson.addEventListener('click', exportToJSON);
  
  // Metadados
  elements.companyName.addEventListener('input', debounce((e) => {
    state.company = e.target.value;
    autoSave();
  }, 500));
  
  elements.bankName.addEventListener('input', debounce((e) => {
    state.bank = e.target.value;
    autoSave();
  }, 500));
  
  elements.pdfNotes.addEventListener('input', debounce((e) => {
    state.pdfNotes = e.target.value;
    autoSave();
  }, 500));
  
  // Reset
  elements.resetData.addEventListener('click', () => {
    const confirmed = confirm(
      '⚠️ ATENÇÃO!\n\n' +
      'Isso irá excluir PERMANENTEMENTE todos os dados:\n' +
      '- Transações\n' +
      '- Contas\n' +
      '- Regras\n' +
      '- Configurações\n\n' +
      'Esta ação não pode ser desfeita!\n\n' +
      'Deseja continuar?'
    );
    
    if (confirmed) {
      localStorage.clear();
      showNotification('🗑️ Todos os dados foram limpos', 'success');
      setTimeout(() => location.reload(), 1000);
    }
  });
  
  // Amostras (opcional)
  elements.loadSamples?.addEventListener('click', loadSampleData);
}

// ============================================
// UTILITÁRIOS
// ============================================

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function loadSampleData() {
  // Dados de exemplo para testes
  const samples = [
    { date: new Date('2026-02-01'), description: 'Receita Cliente ABC', amount: 5000, status: 'pending' },
    { date: new Date('2026-02-02'), description: 'Pagamento Fornecedor XYZ', amount: -2500, status: 'pending' },
    { date: new Date('2026-02-03'), description: 'Tarifa Bancária', amount: -15.90, status: 'pending' },
    { date: new Date('2026-02-04'), description: 'Depósito Cliente DEF', amount: 3200, status: 'pending' },
    { date: new Date('2026-02-05'), description: 'Pagamento Energia', amount: -450.50, status: 'pending' }
  ];
  
  const withIds = samples.map(s => ({
    ...s,
    id: crypto.randomUUID(),
    account: '',
    importedAt: new Date().toISOString()
  }));
  
  state.transactions.push(...withIds);
  
  // Adiciona contas de exemplo
  const sampleAccounts = ['Receita de Vendas', 'Fornecedores', 'Tarifas Bancárias', 'Energia Elétrica'];
  sampleAccounts.forEach(acc => {
    if (!state.accounts.includes(acc)) {
      state.accounts.push(acc);
    }
  });
  
  saveState();
  updateUI();
  showNotification('📦 Dados de exemplo carregados', 'success');
}

// Expor funções globais necessárias
window.removeAccount = removeAccount;

// ============================================
// INICIALIZAÇÃO
// ============================================

function init() {
  console.log(`%c🏦 Conciliador Bancário v${state.version}`, 'color: #4f46e5; font-size: 16px; font-weight: bold;');
  console.log('%cDesenvolvido por Ademir Varjão', 'color: #64748b;');
  console.log('%cLicença: MIT | 100% Open Source', 'color: #64748b;');
  
  loadState();
  setupEventListeners();
  setupDragAndDrop();
  updateUI();
  
  console.log('%c✅ Aplicação inicializada com sucesso!', 'color: #10b981;');
}

// Inicializa quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
