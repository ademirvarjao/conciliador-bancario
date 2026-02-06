/**
 * CONCILIADOR BANCÁRIO v0.7
 * 
 * @description Ferramenta open source de conciliação bancária automática
 * @author Ademir Varjão
 * @license MIT
 * @version 0.7.0
 * @year 2026
 * 
 * Novidades v0.7:
 * - Correção crítica na importação CSV
 * - Suporte a arquivos PDF (texto e imagem com OCR)
 * - Detecção inteligente de colunas CSV
 * - Melhor tratamento de erros
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
  version: '0.7.0',
  lastUpdate: null,
  ocrEnabled: false
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
  statReconciled: $('#stat-reconciled-pct'),
  currencySelect: $('#currency-select'),
  ocrToggle: $('#ocr-toggle')
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
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR');
};

const formatPercent = (val) => {
  return `${Math.round(val * 100)}%`;
};

// ============================================
// SISTEMA DE NOTIFICAÇÕES TOAST
// ============================================

function showNotification(message, type = 'info') {
  const container = $('#toast-container') || createToastContainer();
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
  `;
  
  container.appendChild(toast);
  
  // Animação de entrada
  setTimeout(() => toast.classList.add('toast-show'), 10);
  
  // Auto-remover após 4 segundos
  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
  
  console.log(`[${type.toUpperCase()}]`, message);
}

function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toast-container';
  document.body.appendChild(container);
  return container;
}

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
  str = str.replace(/[R$\u20ac\xa3\xa5USD]/gi, '');
  
  // Detecta formato BR vs EN
  const hasComma = str.includes(',');
  const hasDot = str.includes('.');
  
  if (hasComma && hasDot) {
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
    const validExtensions = ['.ofx', '.csv', '.json', '.pdf'];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!validExtensions.includes(ext)) {
      return { valid: false, error: 'Formato inválido. Use OFX, CSV, JSON ou PDF' };
    }
    return { valid: true };
  },
  
  isValidTransaction(t) {
    if (!t) return false;
    if (!t.description || t.description.trim() === '') return false;
    if (typeof t.amount !== 'number' || isNaN(t.amount)) return false;
    if (!t.date || !(t.date instanceof Date) || isNaN(t.date.getTime())) return false;
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

/**
 * Detecta quais colunas contêm data, descrição e valor em um CSV
 */
function detectCSVColumns(rows) {
  if (rows.length < 2) return null;
  
  const header = rows[0].map(h => h.toLowerCase());
  const sampleRow = rows[1];
  
  // Palavras-chave para identificação
  const dateKeywords = ['data', 'date', 'dt', 'dia'];
  const descKeywords = ['descri', 'historic', 'memo', 'name', 'desc'];
  const amountKeywords = ['valor', 'amount', 'vlr', 'value', 'montante', 'total'];
  
  let dateCol = -1, descCol = -1, amountCol = -1;
  
  // Tenta identificar por cabeçalho
  header.forEach((col, idx) => {
    if (dateCol === -1 && dateKeywords.some(k => col.includes(k))) {
      dateCol = idx;
    }
    if (descCol === -1 && descKeywords.some(k => col.includes(k))) {
      descCol = idx;
    }
    if (amountCol === -1 && amountKeywords.some(k => col.includes(k))) {
      amountCol = idx;
    }
  });
  
  // Se não encontrou por cabeçalho, tenta por análise de dados
  if (dateCol === -1 || descCol === -1 || amountCol === -1) {
    sampleRow.forEach((cell, idx) => {
      const val = cell.trim();
      
      // Detecta data
      if (dateCol === -1 && (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(val) || /^\d{8}$/.test(val))) {
        dateCol = idx;
      }
      
      // Detecta valor monetário
      if (amountCol === -1 && /^[R$\-\+]?\s*[\d\.,]+$/.test(val)) {
        const parsed = parseAmount(val);
        if (!isNaN(parsed) && parsed !== 0) {
          amountCol = idx;
        }
      }
      
      // Descrição: coluna com texto longo
      if (descCol === -1 && val.length > 10 && !/^\d+$/.test(val)) {
        descCol = idx;
      }
    });
  }
  
  // Validação: precisa ter pelo menos data e valor
  if (dateCol !== -1 && amountCol !== -1) {
    // Se não achou descrição, usa a primeira coluna de texto
    if (descCol === -1) {
      for (let i = 0; i < sampleRow.length; i++) {
        if (i !== dateCol && i !== amountCol && sampleRow[i].trim()) {
          descCol = i;
          break;
        }
      }
    }
    
    return { dateCol, descCol, amountCol };
  }
  
  return null;
}

function parseOFX(content) {
  const transactions = [];
  
  try {
    const blocks = content.split('<STMTTRN>').slice(1);
    
    blocks.forEach(block => {
      const getTag = (tag) => {
        const match = block.match(new RegExp(`<${tag}>([^<\\r\\n]+)`));
        return match ? match[1].trim() : '';
      };
      
      const dateStr = getTag('DTPOSTED');
      const amountStr = getTag('TRNAMT');
      const description = getTag('MEMO') || getTag('NAME') || 'Sem descrição';
      
      const date = parseDate(dateStr);
      const amount = parseAmount(amountStr, true);
      
      if (date && !isNaN(amount)) {
        transactions.push({
          date,
          description: validators.sanitizeString(description),
          amount,
          status: 'pending'
        });
      }
    });
  } catch (e) {
    console.error('Erro ao parsear OFX:', e);
    showNotification('Erro ao processar arquivo OFX', 'error');
  }
  
  return transactions;
}

/**
 * Extrai texto de PDF
 */
async function extractTextFromPDF(file) {
  try {
    // Carrega PDF.js
    if (!window.pdfjsLib) {
      showNotification('Carregando biblioteca PDF.js...', 'info');
      await loadPDFJS();
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText;
  } catch (e) {
    console.error('Erro ao extrair texto do PDF:', e);
    throw new Error('Não foi possível extrair texto do PDF');
  }
}

/**
 * Processa PDF usando OCR (Tesseract.js)
 */
async function extractTextWithOCR(file) {
  try {
    if (!window.Tesseract) {
      showNotification('Carregando OCR... Pode demorar um pouco.', 'info');
      await loadTesseract();
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      showNotification(`Processando página ${i} de ${pdf.numPages} com OCR...`, 'info');
      
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });
      
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext('2d');
      
      await page.render({ canvasContext: context, viewport }).promise;
      
      const imageData = canvas.toDataURL('image/png');
      const result = await Tesseract.recognize(imageData, 'por', {
        logger: m => console.log(m)
      });
      
      fullText += result.data.text + '\n';
    }
    
    return fullText;
  } catch (e) {
    console.error('Erro no OCR:', e);
    throw new Error('Falha no processamento OCR');
  }
}

/**
 * Carrega PDF.js dinamicamente
 */
function loadPDFJS() {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) {
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Carrega Tesseract.js dinamicamente
 */
function loadTesseract() {
  return new Promise((resolve, reject) => {
    if (window.Tesseract) {
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Processa PDF e tenta extrair transações
 */
async function processPDF(file, useOCR = false) {
  try {
    let text;
    
    if (useOCR || state.ocrEnabled) {
      showNotification('🔍 Iniciando OCR... Isso pode levar alguns minutos.', 'info');
      text = await extractTextWithOCR(file);
    } else {
      text = await extractTextFromPDF(file);
    }
    
    if (!text || text.trim().length < 50) {
      showNotification('PDF parece ser uma imagem. Ative o OCR e tente novamente.', 'warning');
      return [];
    }
    
    // Tenta detectar formato de extrato bancário
    const lines = text.split('\n').filter(l => l.trim());
    const transactions = [];
    
    // Padrões comuns de extrato
    const patterns = [
      // DD/MM/YYYY Descrição 1.234,56
      /(\d{2}\/\d{2}\/\d{4})\s+([^\d\-\+R$]+?)\s+([\-\+]?R?\$?\s*[\d\.,]+)/gi,
      // DD/MM Descrição Valor
      /(\d{2}\/\d{2})\s+([^\d\-\+R$]+?)\s+([\-\+]?R?\$?\s*[\d\.,]+)/gi
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const date = parseDate(match[1]);
        const description = validators.sanitizeString(match[2]);
        const amount = parseAmount(match[3]);
        
        if (date && description && !isNaN(amount)) {
          transactions.push({ date, description, amount, status: 'pending' });
        }
      }
      
      if (transactions.length > 0) break;
    }
    
    return transactions;
  } catch (e) {
    console.error('Erro ao processar PDF:', e);
    showNotification(e.message || 'Erro ao processar PDF', 'error');
    return [];
  }
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
      
      const fileName = file.name.toLowerCase();
      
      if (fileName.endsWith('.pdf')) {
        showNotification(`📄 Processando PDF: ${file.name}`, 'info');
        const pdfTransactions = await processPDF(file, state.ocrEnabled);
        allNew.push(...pdfTransactions);
        
        if (pdfTransactions.length === 0) {
          errors.push(`${file.name}: Nenhuma transação encontrada no PDF`);
        }
        
        continue;
      }
      
      const text = await file.text();
      
      if (fileName.endsWith('.ofx')) {
        const parsed = parseOFX(text);
        allNew.push(...parsed);
      } else if (fileName.endsWith('.csv')) {
        const rows = parseCSV(text);
        
        if (rows.length < 2) {
          errors.push(`${file.name}: CSV vazio ou inválido`);
          continue;
        }
        
        // Detecta colunas automaticamente
        const columns = detectCSVColumns(rows);
        
        if (!columns) {
          errors.push(`${file.name}: Não foi possível detectar formato do CSV`);
          continue;
        }
        
        const { dateCol, descCol, amountCol } = columns;
        
        // Determina se primeira linha é cabeçalho
        const hasHeader = rows[0].some(cell => 
          /data|descri|valor|amount/i.test(cell)
        );
        
        const dataRows = hasHeader ? rows.slice(1) : rows;
        
        dataRows.forEach(r => {
          if (r.length <= Math.max(dateCol, descCol, amountCol)) return;
          
          const date = parseDate(r[dateCol]);
          const description = validators.sanitizeString(r[descCol] || 'Sem descrição');
          const amount = parseAmount(r[amountCol]);
          
          if (date && description && !isNaN(amount)) {
            allNew.push({
              date,
              description,
              amount,
              status: 'pending'
            });
          }
        });
        
        console.log(`CSV ${file.name}: detectado formato - Data:${dateCol}, Desc:${descCol}, Valor:${amountCol}`);
        
      } else if (fileName.endsWith('.json')) {
        try {
          const data = JSON.parse(text);
          if (Array.isArray(data)) {
            data.forEach(item => {
              if (item.date) item.date = new Date(item.date);
              if (validators.isValidTransaction(item)) {
                allNew.push(item);
              }
            });
          }
        } catch (e) {
          errors.push(`${file.name}: JSON inválido`);
        }
      }
    }
    
    // Adiciona IDs únicos e sugere contas
    const withMetadata = allNew.map(t => ({
      ...t,
      id: t.id || crypto.randomUUID(),
      account: t.account || suggestAccount(t),
      status: t.status || 'pending',
      importedAt: new Date().toISOString()
    }));
    
    // Previne duplicatas
    const existing = new Set(
      state.transactions.map(t => {
        const dateStr = t.date?.toISOString().split('T')[0] || '';
        return `${dateStr}|${t.description}|${t.amount.toFixed(2)}`;
      })
    );
    
    const uniqueNew = withMetadata.filter(t => {
      const dateStr = t.date?.toISOString().split('T')[0] || '';
      const key = `${dateStr}|${t.description}|${t.amount.toFixed(2)}`;
      return !existing.has(key);
    });
    
    state.transactions.push(...uniqueNew);
    
    // Ordena por data (mais recente primeiro)
    state.transactions.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
    
    saveState();
    renderTransactions();
    
    // Notificação de sucesso
    const duplicates = allNew.length - uniqueNew.length;
    let msg = `✅ ${uniqueNew.length} transação(ões) importada(s) com sucesso!`;
    if (duplicates > 0) {
      msg += ` (${duplicates} duplicata(s) ignorada(s))`;
    }
    
    showNotification(msg, 'success');
    elements.importSummary.textContent = msg;
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
    if (elements.fileInput) elements.fileInput.value = '';
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
  
  if (exactMatch) {
    // Incrementa contador de uso
    exactMatch.usageCount = (exactMatch.usageCount || 0) + 1;
    autoSave();
    return exactMatch.account;
  }
  
  // Busca parcial (fallback)
  const partialMatch = state.rules.find(r => {
    const pattern = r.pattern.toLowerCase();
    return desc.includes(pattern) || pattern.includes(desc);
  });
  
  if (partialMatch) {
    partialMatch.usageCount = (partialMatch.usageCount || 0) + 1;
    autoSave();
  }
  
  return partialMatch ? partialMatch.account : '';
}

function createRule(description, account) {
  if (!description || !account) return;
  
  // Evita duplicatas
  const exists = state.rules.find(r => 
    r.pattern.toLowerCase() === description.toLowerCase() && 
    r.account === account
  );
  
  if (exists) {
    exists.usageCount = (exists.usageCount || 0) + 1;
    autoSave();
    return;
  }
  
  state.rules.push({
    pattern: description,
    account: account,
    createdAt: new Date().toISOString(),
    usageCount: 1
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
  
  if (elements.statCredits) elements.statCredits.textContent = formatCurrency(metrics.credits);
  if (elements.statDebits) elements.statDebits.textContent = formatCurrency(metrics.debits);
  if (elements.statBalance) {
    elements.statBalance.textContent = formatCurrency(metrics.balance);
    elements.statBalance.className = metrics.balance >= 0 ? 'stat-value text-success' : 'stat-value text-danger';
  }
  if (elements.statReconciled) elements.statReconciled.textContent = formatPercent(metrics.reconciledPct);
}

// ============================================
// RENDERIZAÇÃO DE TRANSAÇÕES
// ============================================

function renderTransactions() {
  if (!elements.transactionsTable) return;
  
  const term = elements.searchTransactions?.value.toLowerCase() || '';
  const filter = elements.filterStatus?.value || 'all';
  
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
  if (!template) return;
  
  const fragment = document.createDocumentFragment();
  
  filtered.forEach(t => {
    const row = template.content.cloneNode(true);
    const tr = row.querySelector('tr');
    if (tr) tr.dataset.id = t.id;
    
    const dateEl = row.querySelector('[data-field="date"]');
    if (dateEl) dateEl.textContent = formatDate(t.date);
    
    const descEl = row.querySelector('[data-field="description"]');
    if (descEl) {
      descEl.textContent = t.description;
      descEl.title = t.description;
    }
    
    const amtEl = row.querySelector('[data-field="amount"]');
    if (amtEl) {
      amtEl.textContent = formatCurrency(t.amount);
      amtEl.className = `text-right font-medium ${t.amount >= 0 ? 'text-success' : 'text-danger'}`;
    }
    
    const picker = row.querySelector('.account-picker');
    if (picker) {
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
    }
    
    const statusEl = row.querySelector('[data-field="status"]');
    if (statusEl) {
      statusEl.textContent = t.status === 'matched' ? '✅ Conciliado' : '⌛ Pendente';
      statusEl.className = `status-badge status-${t.status}`;
    }
    
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
    return state.transactions.find(t => t.id === tr?.dataset.id);
  }).filter(Boolean);
}

function updateBulkToolbar() {
  if (!elements.bulkActions || !elements.selectedCount) return;
  
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
  if (elements.selectAll) elements.selectAll.checked = false;
  if (elements.bulkAccount) elements.bulkAccount.value = '';
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
  
  if (elements.selectAll) elements.selectAll.checked = false;
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
  
  // Algoritmo de Levenshtein
  const matrix = [];
  
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  const maxLen = Math.max(s1.length, s2.length);
  const distance = matrix[s2.length][s1.length];
  
  return maxLen === 0 ? 1 : (maxLen - distance) / maxLen;
}

function runMatching() {
  if (state.ledgerEntries.length === 0) {
    showNotification('⚠️ Carregue primeiro o arquivo de Razão Contábil', 'warning');
    return;
  }
  
  if (!elements.runReconciliation) return;
  
  const daysTol = parseInt(elements.toleranceDays?.value) || CONFIG.defaultToleranceDays;
  const valTol = parseFloat(elements.toleranceValue?.value) || CONFIG.defaultToleranceValue;
  
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
        if (ledger.matched) return;
        
        // 1. Verifica diferença de data
        const diffDays = Math.abs((bank.date - ledger.date) / 86400000);
        if (diffDays > daysTol) return;
        
        // 2. Verifica diferença de valor
        const diffVal = Math.abs(bank.amount - ledger.value);
        if (diffVal > valTol) return;
        
        // 3. Calcula score de similaridade
        const dateSimilarity = 1 - (diffDays / daysTol);
        const valueSimilarity = 1 - (diffVal / (valTol || 0.01));
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
    
    const msg = `🎯 ${matchCount} conciliação(ões) automática(s) realizada(s)!`;
    showNotification(msg, 'success');
    
    if (elements.reconciliationSummary) {
      elements.reconciliationSummary.textContent = msg;
      elements.reconciliationSummary.className = 'alert alert-success mt-2';
      elements.reconciliationSummary.classList.remove('hidden');
    }
    
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
    if (elements.runReconciliation) elements.runReconciliation.disabled = false;
    
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
    currency: state.currency,
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
  if (elements.companyName) elements.companyName.value = state.company || '';
  if (elements.bankName) elements.bankName.value = state.bank || '';
  if (elements.pdfNotes) elements.pdfNotes.value = state.pdfNotes || '';
  if (elements.currencySelect) elements.currencySelect.value = state.currency || 'BRL';
  if (elements.ocrToggle) elements.ocrToggle.checked = state.ocrEnabled || false;
  
  // Lista de contas
  if (elements.accountsList) {
    elements.accountsList.innerHTML = state.accounts.length === 0
      ? '<p style="color: #94a3b8; text-align: center; padding: 20px;">Nenhuma conta cadastrada</p>'
      : state.accounts.map(acc => 
          `<span class="tag">${acc} <button onclick="removeAccount('${acc.replace(/'/g, "\\'")}')" title="Remover conta">&times;</button></span>`
        ).join('');
  }
  
  // Dropdown de contas para bulk actions
  if (elements.bulkAccount) {
    elements.bulkAccount.innerHTML = `<option value="">Aplicar Conta...</option>` + 
      state.accounts.map(acc => `<option value="${acc}">${acc}</option>`).join('');
  }
  
  renderTransactions();
  renderDashboard();
}

// ============================================
// DRAG AND DROP
// ============================================

function setupDragAndDrop() {
  const dropZone = elements.dropZone;
  if (!dropZone) return;
  
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
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
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0) {
      processUploadedFiles(files);
    }
  });
  
  // Permite click no label
  dropZone.addEventListener('click', () => {
    if (elements.fileInput) elements.fileInput.click();
  });
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Upload e processamento
  if (elements.fileInput) {
    elements.fileInput.addEventListener('change', (e) => {
      processUploadedFiles(e.target.files);
    });
  }
  
  if (elements.parseFiles) {
    elements.parseFiles.addEventListener('click', () => {
      if (elements.fileInput && elements.fileInput.files.length > 0) {
        processUploadedFiles(elements.fileInput.files);
      } else if (elements.fileInput) {
        elements.fileInput.click();
      }
    });
  }
  
  // Contas
  if (elements.addAccount && elements.newAccount) {
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
  }
  
  if (elements.accountsFile) {
    elements.accountsFile.addEventListener('change', (e) => {
      if (e.target.files[0]) {
        importAccountsFromCSV(e.target.files[0]);
        e.target.value = '';
      }
    });
  }
  
  // Busca e filtros
  if (elements.searchTransactions) {
    elements.searchTransactions.addEventListener('input', debounce(renderTransactions, 300));
  }
  
  if (elements.filterStatus) {
    elements.filterStatus.addEventListener('change', renderTransactions);
  }
  
  // Seleção em lote
  if (elements.selectAll) {
    elements.selectAll.addEventListener('change', (e) => {
      $$('.row-checkbox').forEach(cb => {
        cb.checked = e.target.checked;
      });
      updateBulkToolbar();
    });
  }
  
  if (elements.transactionsTable) {
    elements.transactionsTable.addEventListener('change', (e) => {
      if (e.target.classList.contains('row-checkbox')) {
        updateBulkToolbar();
      }
    });
  }
  
  if (elements.bulkAccount) {
    elements.bulkAccount.addEventListener('change', (e) => {
      if (e.target.value) {
        handleBulkAccount(e.target.value);
      }
    });
  }
  
  if (elements.bulkDelete) {
    elements.bulkDelete.addEventListener('click', handleBulkDelete);
  }
  
  // Conciliação
  if (elements.ledgerInput) {
    elements.ledgerInput.addEventListener('change', (e) => {
      if (e.target.files[0]) {
        loadLedgerFile(e.target.files[0]);
      }
    });
  }
  
  if (elements.runReconciliation) {
    elements.runReconciliation.addEventListener('click', runMatching);
  }
  
  // Exportação
  if (elements.exportCsv) {
    elements.exportCsv.addEventListener('click', exportToCSV);
  }
  
  if (elements.exportJson) {
    elements.exportJson.addEventListener('click', exportToJSON);
  }
  
  // Metadados
  if (elements.companyName) {
    elements.companyName.addEventListener('input', debounce((e) => {
      state.company = e.target.value;
      autoSave();
    }, 500));
  }
  
  if (elements.bankName) {
    elements.bankName.addEventListener('input', debounce((e) => {
      state.bank = e.target.value;
      autoSave();
    }, 500));
  }
  
  if (elements.pdfNotes) {
    elements.pdfNotes.addEventListener('input', debounce((e) => {
      state.pdfNotes = e.target.value;
      autoSave();
    }, 500));
  }
  
  // Moeda
  if (elements.currencySelect) {
    elements.currencySelect.addEventListener('change', (e) => {
      state.currency = e.target.value;
      saveState();
      renderDashboard();
      renderTransactions();
    });
  }
  
  // OCR Toggle
  if (elements.ocrToggle) {
    elements.ocrToggle.addEventListener('change', (e) => {
      state.ocrEnabled = e.target.checked;
      autoSave();
      showNotification(
        state.ocrEnabled ? '🔍 OCR ativado para próximos PDFs' : 'OCR desativado',
        'info'
      );
    });
  }
  
  // Reset
  if (elements.resetData) {
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
  }
  
  // Amostras
  if (elements.loadSamples) {
    elements.loadSamples.addEventListener('click', loadSampleData);
  }
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
