/**
 * CONCILIADOR BANCÁRIO v0.7.1
 * 
 * @description Ferramenta open source de conciliação bancária automática
 * @author Ademir Varjão
 * @license MIT
 * @version 0.7.1
 * @year 2026
 * 
 * Novidades v0.7.1:
 * - Correção crítica de segurança XSS
 * - Implementação de paginação para melhor performance
 * - Otimização do algoritmo de matching
 * - Validação de tipo MIME real
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
  version: '0.7.1',
  lastUpdate: null,
  ocrEnabled: false,
  currentPage: 1,
  itemsPerPage: 100,
  reconciliationReport: null,
  previousBalance: null
};

const CONFIG = {
  storageKey: 'conciliador-bancario-v2',
  maxTransactions: 50000,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  defaultToleranceDays: 2,
  defaultToleranceValue: 0.05,
  autoSaveDelay: 500,
  maxStringLengthForSimilarity: 80
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
  ocrToggle: $('#ocr-toggle'),
  paginationContainer: $('#pagination-container'),
  pageInfo: $('#page-info')
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

  const iconEl = document.createElement('span');
  iconEl.className = 'toast-icon';
  iconEl.textContent = icons[type] || icons.info;

  const messageEl = document.createElement('span');
  messageEl.className = 'toast-message';
  messageEl.textContent = message;

  toast.appendChild(iconEl);
  toast.appendChild(messageEl);

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
  if (value === null || value === undefined || value === '') return 0;

  let str = value.toString().trim().replace(/\s/g, '');

  // Trata formato contábil com parênteses: (123,45)
  let isNegativeByParentheses = false;
  if (/^\(.*\)$/.test(str)) {
    isNegativeByParentheses = true;
    str = str.slice(1, -1);
  }

  // Remove símbolos monetários
  str = str.replace(/[R$€£¥USD]/gi, '');

  // Formato OFX: geralmente ponto decimal
  if (isOFX) {
    const parsed = parseFloat(str.replace(',', '.')) || 0;
    return isNegativeByParentheses ? -Math.abs(parsed) : parsed;
  }

  // Suporta sinal no final: 123,45-
  if (/-$/.test(str)) {
    str = `-${str.slice(0, -1)}`;
  }

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
  if (isNaN(result)) return 0;
  return isNegativeByParentheses ? -Math.abs(result) : result;
}

function parseDate(val) {
  if (!val) return null;

  const s = val.toString().trim();

  // YYYYMMDD ou YYYYMMDDHHMMSS (formato OFX)
  const ofxMatch = s.match(/^(\d{8})/);
  if (ofxMatch) {
    const base = ofxMatch[1];
    const year = base.slice(0, 4);
    const month = base.slice(4, 6);
    const day = base.slice(6, 8);
    return new Date(`${year}-${month}-${day}T12:00:00`);
  }

  // DD/MM/YYYY ou DD-MM-YYYY (formato BR)
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(s)) {
    const [day, month, year] = s.split(/[\/\-]/);
    return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00`);
  }

  // DD/MM/YY ou DD-MM-YY
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2}$/.test(s)) {
    const [day, month, year] = s.split(/[\/\-]/);
    const fullYear = Number(year) >= 70 ? `19${year}` : `20${year}`;
    return new Date(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00`);
  }

  // DD/MM ou DD-MM (assume ano atual) - comum em PDFs
  if (/^\d{1,2}[\/\-]\d{1,2}$/.test(s)) {
    const [day, month] = s.split(/[\/\-]/);
    const year = new Date().getFullYear();
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

    const fileName = file.name.toLowerCase();
    const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : '';

    const validExts = new Set(['.ofx', '.csv', '.json', '.pdf']);
    if (ext && validExts.has(ext)) return { valid: true };
    if (ext && !validExts.has(ext)) {
      return { valid: false, error: 'Extensão inválida. Use OFX, CSV, JSON ou PDF' };
    }

    // Fallback por MIME quando não há extensão
    const validMimeTypes = new Set([
      'application/x-ofx',
      'application/ofx',
      'text/csv',
      'application/csv',
      'application/vnd.ms-excel',
      'application/json',
      'application/pdf'
    ]);

    if (!validMimeTypes.has(file.type)) {
      return { valid: false, error: 'Tipo de arquivo inválido. Use OFX, CSV, JSON ou PDF' };
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
    // Método seguro usando textContent
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
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

function detectCSVDelimiter(content) {
  const sample = content.split(/\r?\n/).slice(0, 10).join('\n');
  const candidates = [';', ',', '\t'];

  let best = ';';
  let bestScore = -1;

  candidates.forEach(delimiter => {
    let inQuotes = false;
    let count = 0;

    for (const char of sample) {
      if (char === '"') inQuotes = !inQuotes;
      else if (!inQuotes && char === delimiter) count += 1;
    }

    if (count > bestScore) {
      best = delimiter;
      bestScore = count;
    }
  });

  return best;
}

function parseCSV(content) {
  if (!content || !content.trim()) return [];

  const normalized = content.replace(/^\uFEFF/, '');
  const delimiter = detectCSVDelimiter(normalized);

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const nextChar = normalized[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(field.trim());
      field = '';
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && nextChar === '\n') i += 1;
      row.push(field.trim());
      if (row.some(cell => cell !== '')) rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  row.push(field.trim());
  if (row.some(cell => cell !== '')) rows.push(row);

  return rows;
}

/**
 * Detecta quais colunas contêm data, descrição e valor em um CSV
 */
function detectCSVColumns(rows) {
  if (rows.length < 1) return null;

  const firstRow = rows[0] || [];
  const header = firstRow.map(h => (h || '').toLowerCase());
  const dataSamples = rows.slice(0, Math.min(rows.length, 15));

  // Palavras-chave para identificação
  const dateKeywords = ['data', 'date', 'dt', 'dia', 'lancamento', 'lançamento'];
  const descKeywords = ['descri', 'historic', 'memo', 'name', 'desc', 'histórico'];
  const amountKeywords = ['valor', 'amount', 'vlr', 'value', 'montante', 'total'];

  let dateCol = -1;
  let descCol = -1;
  let amountCol = -1;

  // Tenta identificar por cabeçalho
  header.forEach((col, idx) => {
    if (dateCol === -1 && dateKeywords.some(k => col.includes(k))) dateCol = idx;
    if (descCol === -1 && descKeywords.some(k => col.includes(k))) descCol = idx;
    if (amountCol === -1 && amountKeywords.some(k => col.includes(k))) amountCol = idx;
  });

  const maxCols = Math.max(...dataSamples.map(r => r.length), 0);

  // Se não encontrou por cabeçalho, pontua por amostras
  if (dateCol === -1 || descCol === -1 || amountCol === -1) {
    const scores = Array.from({ length: maxCols }, () => ({ date: 0, amount: 0, desc: 0 }));

    dataSamples.forEach(sample => {
      sample.forEach((cell, idx) => {
        const val = (cell || '').trim();
        if (!val) return;

        if (/^\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?$/.test(val) || /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(val) || /^\d{8}/.test(val)) {
          scores[idx].date += 2;
        }

        if (/^[R$\-\+\(]?\s*[\d\.,]+\)?\-?$/.test(val)) {
          const parsed = parseAmount(val);
          if (!isNaN(parsed)) scores[idx].amount += 2;
        }

        if (val.length > 5 && !/^[\d\W]+$/.test(val)) {
          scores[idx].desc += 1;
        }
      });
    });

    const pickBest = (key, current) => {
      if (current !== -1) return current;
      let bestIdx = -1;
      let bestVal = -1;
      scores.forEach((score, idx) => {
        if (score[key] > bestVal) {
          bestVal = score[key];
          bestIdx = idx;
        }
      });
      return bestVal > 0 ? bestIdx : -1;
    };

    dateCol = pickBest('date', dateCol);
    amountCol = pickBest('amount', amountCol);
    descCol = pickBest('desc', descCol);
  }

  // Validação: precisa ter pelo menos data e valor
  if (dateCol !== -1 && amountCol !== -1) {
    // Se não achou descrição, usa a primeira coluna texto útil
    if (descCol === -1) {
      const baseRow = rows.find(r => r.length > Math.max(dateCol, amountCol)) || firstRow;
      for (let i = 0; i < baseRow.length; i++) {
        const val = (baseRow[i] || '').trim();
        if (i !== dateCol && i !== amountCol && val) {
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
    const blocks = content.split(/<STMTTRN>/i).slice(1);

    blocks.forEach(block => {
      const getTag = (tag) => {
        const match = block.match(new RegExp(`<${tag}>([^<\r\n]+)`, 'i'));
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

function detectBalanceColumn(rows) {
  if (!rows || rows.length === 0) return -1;
  const header = (rows[0] || []).map(c => (c || '').toLowerCase());
  return header.findIndex(col => /saldo|balance|running/i.test(col));
}

function extractPreviousBalanceFromRows(rows, columns, hasHeader = true) {
  const balanceCol = detectBalanceColumn(rows);
  if (balanceCol === -1) return null;

  const dataRows = hasHeader ? rows.slice(1) : rows;
  const firstValid = dataRows.find(r => r.length > Math.max(columns.dateCol, columns.amountCol, balanceCol));
  if (!firstValid) return null;

  const amount = parseAmount(firstValid[columns.amountCol]);
  const runningBalance = parseAmount(firstValid[balanceCol]);
  if (isNaN(amount) || isNaN(runningBalance)) return null;

  return runningBalance - amount;
}

function parseTransactionsFromPDFText(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const transactions = [];
  let detectedPreviousBalance = null;

  const linePattern = /^(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)\s+(.+?)\s+([\(\)\-\+]?\s*R?\$?\s*[\d\.,]+\-?)\s*(?:([\(\)\-\+]?\s*R?\$?\s*[\d\.,]+\-?))?$/i;

  lines.forEach(line => {
    const match = line.match(linePattern);
    if (!match) return;

    const date = parseDate(match[1]);
    const description = validators.sanitizeString(match[2]);
    const amount = parseAmount(match[3]);
    const maybeRunningBalance = match[4] ? parseAmount(match[4]) : null;

    if (!date || !description || isNaN(amount)) return;

    transactions.push({ date, description, amount, status: 'pending' });

    if (detectedPreviousBalance === null && maybeRunningBalance !== null && !isNaN(maybeRunningBalance)) {
      detectedPreviousBalance = maybeRunningBalance - amount;
    }
  });

  return { transactions, detectedPreviousBalance };
}

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
      return { transactions: [], detectedPreviousBalance: null };
    }

    const parsed = parseTransactionsFromPDFText(text);
    return parsed;
  } catch (e) {
    console.error('Erro ao processar PDF:', e);
    showNotification(e.message || 'Erro ao processar PDF', 'error');
    return { transactions: [], detectedPreviousBalance: null };
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
  let detectedPreviousBalance = null;
  
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
        const pdfResult = await processPDF(file, state.ocrEnabled);
        allNew.push(...pdfResult.transactions);
        if (detectedPreviousBalance === null && pdfResult.detectedPreviousBalance !== null) {
          detectedPreviousBalance = pdfResult.detectedPreviousBalance;
        }
        
        if (pdfResult.transactions.length === 0) {
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
        
        if (rows.length < 1) {
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
        const hasHeader = (rows[0] || []).some(cell =>
          /data|descri|valor|amount|hist|memo|conta|account/i.test((cell || '').toLowerCase())
        );
        
        const dataRows = hasHeader ? rows.slice(1) : rows;

        if (detectedPreviousBalance === null) {
          const prev = extractPreviousBalanceFromRows(rows, columns, hasHeader);
          if (prev !== null && !isNaN(prev)) detectedPreviousBalance = prev;
        }
        
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

    // Mantém todas as linhas importadas (inclusive repetições legítimas)
    const remainingCapacity = Math.max(0, CONFIG.maxTransactions - state.transactions.length);
    const toInsert = withMetadata.slice(0, remainingCapacity);

    state.transactions.push(...toInsert);
    
    // Ordena por data (mais recente primeiro)
    state.transactions.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
    
    saveState();
    renderTransactions();
    
    // Notificação de sucesso
    const ignoredByCapacity = allNew.length - toInsert.length;
    let msg = `✅ ${toInsert.length} transação(ões) importada(s) com sucesso!`;
    if (ignoredByCapacity > 0) {
      msg += ` (${ignoredByCapacity} ignorada(s) por limite de ${CONFIG.maxTransactions})`;
    }

    if (detectedPreviousBalance !== null && !isNaN(detectedPreviousBalance)) {
      state.previousBalance = detectedPreviousBalance;
      msg += ` | Saldo anterior identificado: ${formatCurrency(detectedPreviousBalance)}`;
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
    reconciledPct: 0,
    previousBalance: typeof state.previousBalance === 'number' ? state.previousBalance : null
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
    elements.statBalance.title = metrics.previousBalance !== null
      ? `Saldo anterior identificado: ${formatCurrency(metrics.previousBalance)}`
      : 'Saldo anterior não identificado';
  }
  if (elements.statReconciled) elements.statReconciled.textContent = formatPercent(metrics.reconciledPct);
}

// ============================================
// PAGINAÇÃO
// ============================================

function getFilteredTransactions() {
  const term = elements.searchTransactions?.value.toLowerCase() || '';
  const filter = elements.filterStatus?.value || 'all';
  
  return state.transactions.filter(t => {
    const matchesTerm = !term || 
      t.description.toLowerCase().includes(term) || 
      (t.account || '').toLowerCase().includes(term);
    
    const matchesStatus = filter === 'all' || t.status === filter;
    
    return matchesTerm && matchesStatus;
  });
}

function renderPagination(currentPage, totalPages, totalItems) {
  if (!elements.paginationContainer) return;
  
  if (totalPages <= 1) {
    elements.paginationContainer.classList.add('hidden');
    return;
  }
  
  elements.paginationContainer.classList.remove('hidden');
  
  const startItem = (currentPage - 1) * state.itemsPerPage + 1;
  const endItem = Math.min(currentPage * state.itemsPerPage, totalItems);
  
  elements.paginationContainer.innerHTML = `
    <button 
      id="prev-page" 
      ${currentPage === 1 ? 'disabled' : ''}
      class="btn btn-sm"
    >← Anterior</button>
    <span id="page-info">Página ${currentPage} de ${totalPages} (${startItem}-${endItem} de ${totalItems})</span>
    <button 
      id="next-page" 
      ${currentPage === totalPages ? 'disabled' : ''}
      class="btn btn-sm"
    >Próximo →</button>
  `;
  
  // Event listeners para botões
  const prevBtn = $('#prev-page');
  const nextBtn = $('#next-page');
  
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (state.currentPage > 1) {
        state.currentPage--;
        renderTransactions();
      }
    });
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (state.currentPage < totalPages) {
        state.currentPage++;
        renderTransactions();
      }
    });
  }
}

// ============================================
// RENDERIZAÇÃO DE TRANSAÇÕES
// ============================================

function renderTransactions() {
  if (!elements.transactionsTable) return;
  
  const filtered = getFilteredTransactions();
  const totalPages = Math.ceil(filtered.length / state.itemsPerPage);
  
  // Ajusta página atual se necessário
  if (state.currentPage > totalPages && totalPages > 0) {
    state.currentPage = totalPages;
  }
  if (state.currentPage < 1) {
    state.currentPage = 1;
  }
  
  // Calcula índices da página atual
  const startIdx = (state.currentPage - 1) * state.itemsPerPage;
  const endIdx = startIdx + state.itemsPerPage;
  const pageItems = filtered.slice(startIdx, endIdx);
  
  elements.transactionsTable.innerHTML = '';
  
  if (pageItems.length === 0) {
    elements.transactionsTable.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #94a3b8;">Nenhuma transação encontrada</td></tr>';
    renderPagination(1, 1, 0);
    return;
  }
  
  const template = $('#transaction-row-template');
  if (!template) return;
  
  const fragment = document.createDocumentFragment();
  
  pageItems.forEach(t => {
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
      const matchLabel = t.matchType ? ` (${t.matchType})` : '';
      statusEl.textContent = t.status === 'matched' ? `✅ Conciliado${matchLabel}` : '⏳ Pendente';
      statusEl.className = `status-badge status-${t.status}`;
    }
    
    fragment.appendChild(row);
  });
  
  elements.transactionsTable.appendChild(fragment);
  renderPagination(state.currentPage, totalPages, filtered.length);
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
// CONCILIAÇÃO (MATCHING) - OTIMIZADO
// ============================================

function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  // Limita comprimento das strings (Issue #4)
  const s1 = str1.toLowerCase().slice(0, CONFIG.maxStringLengthForSimilarity);
  const s2 = str2.toLowerCase().slice(0, CONFIG.maxStringLengthForSimilarity);
  
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  // Algoritmo de Levenshtein otimizado
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

function normalizeHistory(description) {
  return (description || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(pagamento|pgto|pix|ted|doc|debito|credito|transferencia|transf|lote|parcela)\b/g, ' ')
    .replace(/\b[a-z]\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clearPreviousReconciliation() {
  state.transactions.forEach(transaction => {
    transaction.status = 'pending';
    delete transaction.matchedWith;
    delete transaction.matchType;
    delete transaction.reconciliationId;
    delete transaction.matchScore;
  });

  state.ledgerEntries.forEach(entry => {
    entry.matched = false;
    delete entry.matchType;
    delete entry.reconciliationId;
  });

  state.reconciliationReport = null;
}

function runMatching() {
  if (state.ledgerEntries.length === 0) {
    showNotification('⚠️ Carregue primeiro o arquivo de Razão Contábil', 'warning');
    return;
  }
  
  if (!elements.runReconciliation) return;
  
  const daysTol = parseInt(elements.toleranceDays?.value) || CONFIG.defaultToleranceDays;
  const valTol = parseFloat(elements.toleranceValue?.value) || CONFIG.defaultToleranceValue;

  clearPreviousReconciliation();

  elements.runReconciliation.disabled = true;
  elements.runReconciliation.textContent = 'Processando...';
  
  const matchingResult = {
    exactMatches: [],
    toleranceMatches: [],
    fuzzyMatches: [],
    groupMatches: []
  };
  
  try {
    const getPendingTransactions = () => state.transactions.filter(bank => bank.status !== 'matched');
    const getPendingLedgers = () => state.ledgerEntries.filter(ledger => !ledger.matched);
    let reconciliationId = Date.now();

    const applyMatch = (bank, ledger, type, extra = {}) => {
      bank.status = 'matched';
      bank.account = ledger.account || bank.account;
      bank.matchedWith = ledger.id;
      bank.matchType = type;
      bank.reconciliationId = reconciliationId;
      bank.matchScore = extra.score || 1;
      ledger.matched = true;
      ledger.matchType = type;
      ledger.reconciliationId = reconciliationId;
      reconciliationId += 1;
    };

    // [1/3] Conciliação exata (mesmo valor e mesma data)
    getPendingTransactions().forEach(bank => {
      const match = getPendingLedgers().find(ledger => {
        const diffVal = Math.abs(bank.amount - ledger.value);
        const sameDate = bank.date?.toDateString() === ledger.date?.toDateString();
        return diffVal <= valTol && sameDate;
      });

      if (!match) return;

      applyMatch(bank, match, 'EXATA', { score: 1 });
      matchingResult.exactMatches.push({
        type: 'EXATA',
        bankId: bank.id,
        ledgerId: match.id,
        value: bank.amount,
        dateBank: bank.date,
        dateLedger: match.date
      });
    });

    // [2/3] Conciliação com tolerância de dias (mesmo valor, datas próximas)
    getPendingTransactions().forEach(bank => {
      const match = getPendingLedgers().find(ledger => {
        const diffVal = Math.abs(bank.amount - ledger.value);
        const diffDays = Math.abs((bank.date - ledger.date) / 86400000);
        return diffVal <= valTol && diffDays <= daysTol;
      });

      if (!match) return;

      const diffDays = Math.abs((bank.date - match.date) / 86400000);
      applyMatch(bank, match, 'TOLERANCIA', {
        score: Math.max(0.7, 1 - (diffDays / Math.max(daysTol, 1)))
      });
      matchingResult.toleranceMatches.push({
        type: 'TOLERANCIA',
        bankId: bank.id,
        ledgerId: match.id,
        value: bank.amount,
        differenceDays: diffDays,
        dateBank: bank.date,
        dateLedger: match.date
      });
    });

    // [3/3] Conciliação fuzzy (similaridade de descrição + valor)
    getPendingTransactions().forEach(bank => {
      let bestMatch = null;
      let bestScore = 0;

      getPendingLedgers().forEach(ledger => {
        const diffVal = Math.abs(bank.amount - ledger.value);
        if (diffVal > valTol) return;

        const score = calculateSimilarity(bank.description, ledger.description || '');
        if (score > bestScore && score >= 0.6) {
          bestScore = score;
          bestMatch = ledger;
        }
      });

      if (!bestMatch) return;

      applyMatch(bank, bestMatch, 'FUZZY', { score: bestScore });
      matchingResult.fuzzyMatches.push({
        type: 'FUZZY',
        bankId: bank.id,
        ledgerId: bestMatch.id,
        value: bank.amount,
        similarity: bestScore,
        descriptionBank: bank.description,
        descriptionLedger: bestMatch.description
      });
    });

    // [4/4] Conciliação em grupo por histórico semelhante (N:N)
    const bankGroups = new Map();
    const ledgerGroups = new Map();

    getPendingTransactions().forEach(bank => {
      const key = normalizeHistory(bank.description);
      if (!key) return;
      if (!bankGroups.has(key)) bankGroups.set(key, []);
      bankGroups.get(key).push(bank);
    });

    getPendingLedgers().forEach(ledger => {
      const key = normalizeHistory(ledger.description);
      if (!key) return;
      if (!ledgerGroups.has(key)) ledgerGroups.set(key, []);
      ledgerGroups.get(key).push(ledger);
    });

    bankGroups.forEach((bankGroup, bankKey) => {
      if (bankGroup.length < 2) return;

      const totalBank = bankGroup.reduce((sum, item) => sum + item.amount, 0);
      const minBankDate = Math.min(...bankGroup.map(i => i.date?.getTime() || 0));
      const maxBankDate = Math.max(...bankGroup.map(i => i.date?.getTime() || 0));

      let chosenLedgerKey = null;
      let chosenScore = 0;

      ledgerGroups.forEach((ledgerGroup, ledgerKey) => {
        if (ledgerGroup.length < 2) return;
        const sim = calculateSimilarity(bankKey, ledgerKey);
        if (sim < 0.65) return;

        const totalLedger = ledgerGroup.reduce((sum, item) => sum + item.value, 0);
        const diffVal = Math.abs(totalBank - totalLedger);
        if (diffVal > valTol * Math.max(bankGroup.length, ledgerGroup.length)) return;

        const minLedgerDate = Math.min(...ledgerGroup.map(i => i.date?.getTime() || 0));
        const maxLedgerDate = Math.max(...ledgerGroup.map(i => i.date?.getTime() || 0));
        const diffDays = Math.abs((minBankDate - minLedgerDate) / 86400000);
        const diffDays2 = Math.abs((maxBankDate - maxLedgerDate) / 86400000);
        if (Math.max(diffDays, diffDays2) > daysTol) return;

        if (sim > chosenScore) {
          chosenScore = sim;
          chosenLedgerKey = ledgerKey;
        }
      });

      if (!chosenLedgerKey) return;
      const ledgerGroup = ledgerGroups.get(chosenLedgerKey);
      if (!ledgerGroup || ledgerGroup.some(item => item.matched) || bankGroup.some(item => item.status === 'matched')) return;

      const groupReconId = reconciliationId;
      reconciliationId += 1;

      bankGroup.forEach(bank => {
        bank.status = 'matched';
        bank.matchType = 'GRUPO';
        bank.reconciliationId = groupReconId;
        bank.matchScore = chosenScore;
      });

      ledgerGroup.forEach(ledger => {
        ledger.matched = true;
        ledger.matchType = 'GRUPO';
        ledger.reconciliationId = groupReconId;
      });

      matchingResult.groupMatches.push({
        type: 'GRUPO',
        reconciliationId: groupReconId,
        bankCount: bankGroup.length,
        ledgerCount: ledgerGroup.length,
        similarity: chosenScore,
        bankTotal: bankGroup.reduce((sum, i) => sum + i.amount, 0),
        ledgerTotal: ledgerGroup.reduce((sum, i) => sum + i.value, 0),
        bankKey,
        ledgerKey: chosenLedgerKey
      });
    });

    const matchCount = matchingResult.exactMatches.length + matchingResult.toleranceMatches.length + matchingResult.fuzzyMatches.length + matchingResult.groupMatches.length;


    state.reconciliationReport = {
      generatedAt: new Date().toISOString(),
      toleranceDays: daysTol,
      toleranceValue: valTol,
      totals: {
        bankTransactions: state.transactions.length,
        ledgerEntries: state.ledgerEntries.length,
        matchedTransactions: state.transactions.filter(t => t.status === 'matched').length,
        pendingTransactions: state.transactions.filter(t => t.status !== 'matched').length,
        pendingLedgerEntries: state.ledgerEntries.filter(l => !l.matched).length
      },
      matches: matchingResult
    };
    
    saveState();
    renderTransactions();
    
    const msg = `🎯 ${matchCount} conciliação(ões): ${matchingResult.exactMatches.length} exata(s), ${matchingResult.toleranceMatches.length} tolerância, ${matchingResult.fuzzyMatches.length} fuzzy, ${matchingResult.groupMatches.length} em grupo.`;
    showNotification(msg, 'success');
    
    if (elements.reconciliationSummary) {
      elements.reconciliationSummary.textContent = msg;
      elements.reconciliationSummary.className = 'alert alert-success mt-2';
      elements.reconciliationSummary.classList.remove('hidden');
    }
    
    console.log('Relatório de conciliação:', state.reconciliationReport);
    
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

    if (rows.length < 1) {
      showNotification('Arquivo de razão vazio ou inválido', 'warning');
      return;
    }

    const columns = detectCSVColumns(rows);
    if (!columns) {
      showNotification('Não foi possível detectar colunas do razão (data/descrição/valor)', 'error');
      return;
    }

    const header = rows[0].map(cell => cell.toLowerCase());
    const hasHeader = header.some(cell => /data|descri|valor|amount|conta|account/i.test(cell));
    const accountCol = header.findIndex(cell => /conta|account|plano/i.test(cell));

    const dataRows = hasHeader ? rows.slice(1) : rows;

    state.ledgerEntries = [];

    dataRows.forEach(r => {
      if (r.length <= Math.max(columns.dateCol, columns.amountCol, columns.descCol)) return;

      const date = parseDate(r[columns.dateCol]);
      const description = validators.sanitizeString(r[columns.descCol] || 'Sem descrição');
      const value = parseAmount(r[columns.amountCol]);
      const account = accountCol >= 0 && r[accountCol]
        ? validators.sanitizeString(r[accountCol])
        : '';

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

    clearPreviousReconciliation();
    saveState();
    renderTransactions();

    showNotification(`📊 ${state.ledgerEntries.length} lançamentos carregados do razão`, 'success');
    if (elements.runReconciliation) elements.runReconciliation.disabled = state.ledgerEntries.length === 0;

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
  
  const headers = ['Data', 'Descrição', 'Valor', 'Conta Contábil', 'Status', 'Tipo Match', 'Score'];
  const rows = state.transactions.map(t => [
    formatDate(t.date),
    `"${t.description}"`,
    t.amount.toFixed(2),
    `"${t.account || ''}"`,
    t.status === 'matched' ? 'Conciliado' : 'Pendente',
    t.matchType || '',
    t.matchScore ? t.matchScore.toFixed(4) : ''
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
    metrics: calculateMetrics(),
    reconciliationReport: state.reconciliationReport
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
  
  // Busca e filtros - reseta para primeira página ao filtrar
  if (elements.searchTransactions) {
    elements.searchTransactions.addEventListener('input', debounce(() => {
      state.currentPage = 1;
      renderTransactions();
    }, 300));
  }
  
  if (elements.filterStatus) {
    elements.filterStatus.addEventListener('change', () => {
      state.currentPage = 1;
      renderTransactions();
    });
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

// Expõe funções globais necessárias
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
