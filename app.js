 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/app.js b/app.js
index cb6ff8c262b3f361cb16a79eb6c976d216fe5a81..bfb6973f88f7cb886f8d78465f1835dfd7272a95 100644
--- a/app.js
+++ b/app.js
@@ -1,106 +1,117 @@
 const state = {
   transactions: [],
   accounts: [],
   rules: [],
   ledgerEntries: [],
   company: '',
   bank: '',
   currency: 'BRL',
+  pdfNotes: '',
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
+  if (!str) return 0;
+
+  const isNegative = str.includes('(') && str.includes(')');
+  if (isNegative) {
+    str = str.replace(/[()]/g, '');
+  }
   
   if (isOFX) {
     // OFX usa padrão ponto decimal: -123.45
-    return parseFloat(str) || 0;
+    const parsed = parseFloat(str);
+    if (Number.isNaN(parsed)) return 0;
+    return isNegative ? Math.abs(parsed) * -1 : parsed;
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
 
-  return parseFloat(str) || 0;
+  const parsed = parseFloat(str);
+  if (Number.isNaN(parsed)) return 0;
+  return isNegative ? Math.abs(parsed) * -1 : parsed;
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
@@ -111,84 +122,94 @@ function formatMoney(value) {
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
 
+function detectDelimiter(sample) {
+  const commaCount = (sample.match(/,/g) || []).length;
+  const semicolonCount = (sample.match(/;/g) || []).length;
+  return semicolonCount > commaCount ? ';' : ',';
+}
+
 function parseCSV(content) {
   const rows = [];
   let current = '';
   let inQuotes = false;
   let values = [];
+  const delimiter = detectDelimiter(content.split(/\r?\n/)[0] || '');
   
   for (let i = 0; i < content.length; i += 1) {
     const char = content[i];
     if (char === '"') {
       if (content[i + 1] === '"') {
         current += '"';
         i += 1;
       } else {
         inQuotes = !inQuotes;
       }
-    } else if (char === ',' && !inQuotes) {
+    } else if (char === delimiter && !inQuotes) {
       values.push(current);
       current = '';
     } else if ((char === '\n' || char === '\r') && !inQuotes) {
-      if (current || values.length) {
-        values.push(current);
-        rows.push(values);
-        values = [];
-        current = '';
+      if (char === '\r' && content[i + 1] === '\n') {
+        i += 1;
       }
+      values.push(current);
+      rows.push(values);
+      values = [];
+      current = '';
     } else {
       current += char;
     }
   }
   if (current || values.length) {
     values.push(current);
     rows.push(values);
   }
-  return rows.map(row => row.map(item => item.trim()));
+  return rows
+    .filter(row => row.some(cell => cell.trim() !== ''))
+    .map(row => row.map(item => item.trim()));
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
 
@@ -239,50 +260,51 @@ function applyRules(transaction) {
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
+  elements.importSummary.classList.toggle('hidden', total === 0);
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
     
@@ -380,157 +402,237 @@ function parseFiles(files) {
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
 
+  if (!state.ledgerEntries.length) {
+    elements.reconciliationSummary.textContent = 'Nenhum lançamento contábil carregado.';
+    elements.reconciliationSummary.classList.remove('hidden');
+    return;
+  }
+
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
+  elements.reconciliationSummary.classList.toggle('hidden', matches.length === 0 && remaining.length === 0);
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
-    const csv = 'data,descricao,debito,credito,conta,status\n' + 
+    const csv = '\ufeff' + 'data,descricao,debito,credito,conta,status\n' + 
       data.map(t => `${t.date},"${t.description}",${t.debit},${t.credit},"${t.account}",${t.status}`).join('\n');
     const blob = new Blob([csv], { type: 'text/csv' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url; a.download = 'extrato-unificado.csv'; a.click();
   }
 }
 
+function saveMetadata() {
+  state.company = elements.companyName.value.trim();
+  state.bank = elements.bankName.value.trim();
+  state.currency = elements.currency.value;
+  state.pdfNotes = elements.pdfNotes.value;
+  saveState();
+}
+
+function hydrateMetadata() {
+  elements.companyName.value = state.company || '';
+  elements.bankName.value = state.bank || '';
+  elements.currency.value = state.currency || 'BRL';
+  elements.pdfNotes.value = state.pdfNotes || '';
+}
+
+function loadSampleData() {
+  const sampleTransactions = [
+    {
+      date: new Date(),
+      description: 'Recebimento PIX Cliente A',
+      debit: 0,
+      credit: 1250.5,
+      balance: null,
+      raw: 'sample',
+    },
+    {
+      date: new Date(),
+      description: 'Pagamento Energia elétrica',
+      debit: 320.75,
+      credit: 0,
+      balance: null,
+      raw: 'sample',
+    },
+  ];
+
+  const sampleLedger = [
+    {
+      date: new Date(),
+      description: 'Recebimento PIX Cliente A',
+      value: 1250.5,
+      account: 'Receitas - Vendas',
+    },
+    {
+      date: new Date(),
+      description: 'Pagamento Energia elétrica',
+      value: -320.75,
+      account: 'Despesas - Energia',
+    },
+  ];
+
+  updateTransactions(sampleTransactions);
+  state.ledgerEntries = sampleLedger;
+  saveState();
+  renderReconciliation([], state.ledgerEntries);
+}
+
 function init() {
   loadState();
+  hydrateMetadata();
   renderAccounts();
   renderRules();
   renderTransactions();
   renderSummary();
 
   elements.parseFiles.onclick = () => {
     if (elements.fileInput.files.length) {
-      state.currency = elements.currency.value;
+      saveMetadata();
       parseFiles(elements.fileInput.files);
+      elements.fileInput.value = '';
+    } else {
+      elements.importSummary.textContent = 'Selecione ao menos um arquivo para processar.';
+      elements.importSummary.classList.remove('hidden');
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
+  elements.downloadUnified.onclick = () => exportData('csv');
   elements.accountsFile.onchange = e => handleAccountsImport(e.target.files[0]);
   elements.ledgerInput.onchange = e => handleLedgerImport(e.target.files[0]);
+
+  elements.companyName.oninput = saveMetadata;
+  elements.bankName.oninput = saveMetadata;
+  elements.currency.onchange = saveMetadata;
+  elements.pdfNotes.oninput = saveMetadata;
+  elements.loadSamples.onclick = () => {
+    if (state.transactions.length && !confirm('Carregar amostras vai adicionar novos dados. Continuar?')) {
+      return;
+    }
+    loadSampleData();
+  };
 }
 
 init();
 
EOF
)
