 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/app.js b/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..078dff1c603e2099b5e6af0958bd0bd49fec36ec
--- /dev/null
+++ b/app.js
@@ -0,0 +1,533 @@
+const state = {
+  transactions: [],
+  accounts: [],
+  rules: [],
+  ledgerEntries: [],
+  company: '',
+  bank: '',
+  currency: 'BRL',
+};
+
+const storageKey = 'conciliador-bancario-data-v1';
+
+const elements = {
+  fileInput: document.querySelector('#file-input'),
+  parseFiles: document.querySelector('#parse-files'),
+  importSummary: document.querySelector('#import-summary'),
+  downloadUnified: document.querySelector('#download-unified'),
+  accountsFile: document.querySelector('#accounts-file'),
+  addAccount: document.querySelector('#add-account'),
+  newAccount: document.querySelector('#new-account'),
+  accountsList: document.querySelector('#accounts-list'),
+  rulePattern: document.querySelector('#rule-pattern'),
+  ruleAccount: document.querySelector('#rule-account'),
+  addRule: document.querySelector('#add-rule'),
+  rulesList: document.querySelector('#rules-list'),
+  transactionsTable: document.querySelector('#transactions-table tbody'),
+  searchTransactions: document.querySelector('#search-transactions'),
+  filterStatus: document.querySelector('#filter-status'),
+  ledgerInput: document.querySelector('#ledger-input'),
+  toleranceDays: document.querySelector('#tolerance-days'),
+  toleranceValue: document.querySelector('#tolerance-value'),
+  runReconciliation: document.querySelector('#run-reconciliation'),
+  reconciliationSummary: document.querySelector('#reconciliation-summary'),
+  reconciliationTable: document.querySelector('#reconciliation-table tbody'),
+  exportCsv: document.querySelector('#export-csv'),
+  exportJson: document.querySelector('#export-json'),
+  loadSamples: document.querySelector('#load-samples'),
+  resetData: document.querySelector('#reset-data'),
+  companyName: document.querySelector('#company-name'),
+  bankName: document.querySelector('#bank-name'),
+  currency: document.querySelector('#currency'),
+};
+
+function saveState() {
+  localStorage.setItem(storageKey, JSON.stringify(state));
+}
+
+function loadState() {
+  const raw = localStorage.getItem(storageKey);
+  if (!raw) return;
+  try {
+    const parsed = JSON.parse(raw);
+    Object.assign(state, parsed);
+  } catch (error) {
+    console.warn('Falha ao carregar estado', error);
+  }
+}
+
+function formatMoney(value) {
+  if (value === null || value === undefined || Number.isNaN(value)) return '-';
+  return new Intl.NumberFormat('pt-BR', {
+    style: 'currency',
+    currency: state.currency || 'BRL',
+  }).format(value);
+}
+
+function parseDate(value) {
+  if (!value) return null;
+  if (value instanceof Date) return value;
+  const cleaned = value.toString().trim();
+  if (cleaned.includes('-')) {
+    const parsed = new Date(cleaned);
+    return Number.isNaN(parsed.getTime()) ? null : parsed;
+  }
+  if (cleaned.length >= 8) {
+    const year = cleaned.slice(0, 4);
+    const month = cleaned.slice(4, 6);
+    const day = cleaned.slice(6, 8);
+    const parsed = new Date(`${year}-${month}-${day}`);
+    return Number.isNaN(parsed.getTime()) ? null : parsed;
+  }
+  return null;
+}
+
+function parseCSV(content) {
+  const rows = [];
+  let current = '';
+  let inQuotes = false;
+  const values = [];
+  for (let i = 0; i < content.length; i += 1) {
+    const char = content[i];
+    if (char === '"') {
+      if (content[i + 1] === '"') {
+        current += '"';
+        i += 1;
+      } else {
+        inQuotes = !inQuotes;
+      }
+    } else if (char === ',' && !inQuotes) {
+      values.push(current);
+      current = '';
+    } else if ((char === '\n' || char === '\r') && !inQuotes) {
+      if (current || values.length) {
+        values.push(current);
+        rows.push(values.splice(0));
+        current = '';
+      }
+    } else {
+      current += char;
+    }
+  }
+  if (current || values.length) {
+    values.push(current);
+    rows.push(values);
+  }
+  return rows.map((row) => row.map((item) => item.trim()));
+}
+
+function parseOFX(content) {
+  const transactions = [];
+  const stmt = content.split('<STMTTRN>').slice(1);
+  stmt.forEach((block) => {
+    const getTag = (tag) => {
+      const match = block.match(new RegExp(`<${tag}>([^<\r\n]+)`));
+      return match ? match[1].trim() : '';
+    };
+    const date = parseDate(getTag('DTPOSTED'));
+    const amount = parseFloat(getTag('TRNAMT').replace(',', '.'));
+    const memo = getTag('MEMO') || getTag('NAME');
+    transactions.push({
+      date,
+      description: memo,
+      debit: amount < 0 ? Math.abs(amount) : 0,
+      credit: amount > 0 ? amount : 0,
+      balance: null,
+      raw: block,
+    });
+  });
+  return transactions;
+}
+
+function normalizeTransactions(rows) {
+  if (!rows.length) return [];
+  const header = rows[0].map((cell) => cell.toLowerCase());
+  const hasHeader = header.some((cell) => ['data', 'date', 'descricao', 'histórico', 'historico', 'debito', 'credito', 'valor', 'saldo'].includes(cell));
+  const startIndex = hasHeader ? 1 : 0;
+  const indexOf = (names) => header.findIndex((cell) => names.includes(cell));
+  const dateIndex = hasHeader ? indexOf(['data', 'date']) : 0;
+  const descriptionIndex = hasHeader ? indexOf(['descricao', 'histórico', 'historico', 'descricao']) : 1;
+  const debitIndex = hasHeader ? indexOf(['debito', 'débito']) : 2;
+  const creditIndex = hasHeader ? indexOf(['credito', 'crédito']) : 3;
+  const valueIndex = hasHeader ? indexOf(['valor', 'amount']) : -1;
+  const balanceIndex = hasHeader ? indexOf(['saldo', 'balance']) : -1;
+
+  return rows.slice(startIndex).filter((row) => row.length).map((row) => {
+    const date = parseDate(row[dateIndex]);
+    const description = row[descriptionIndex] || '';
+    const debitRaw = row[debitIndex];
+    const creditRaw = row[creditIndex];
+    const valueRaw = valueIndex >= 0 ? row[valueIndex] : '';
+    const debit = debitRaw ? parseFloat(debitRaw.replace('.', '').replace(',', '.')) : 0;
+    const credit = creditRaw ? parseFloat(creditRaw.replace('.', '').replace(',', '.')) : 0;
+    let value = valueRaw ? parseFloat(valueRaw.replace('.', '').replace(',', '.')) : 0;
+    if (!value && (debit || credit)) {
+      value = credit || -debit;
+    }
+    const balance = balanceIndex >= 0 ? parseFloat(row[balanceIndex].replace('.', '').replace(',', '.')) : null;
+    return {
+      date,
+      description,
+      debit: debit || (value < 0 ? Math.abs(value) : 0),
+      credit: credit || (value > 0 ? value : 0),
+      balance: Number.isNaN(balance) ? null : balance,
+      raw: row,
+    };
+  });
+}
+
+function applyRules(transaction) {
+  for (const rule of state.rules) {
+    const regex = new RegExp(rule.pattern, 'i');
+    if (regex.test(transaction.description)) {
+      return rule.account;
+    }
+  }
+  return '';
+}
+
+function updateTransactions(transactions) {
+  const updated = transactions.map((item) => ({
+    id: crypto.randomUUID(),
+    status: 'pending',
+    account: applyRules(item),
+    ...item,
+  }));
+  state.transactions = state.transactions.concat(updated);
+  saveState();
+  renderTransactions();
+  renderSummary();
+}
+
+function renderSummary() {
+  const total = state.transactions.length;
+  const matched = state.transactions.filter((item) => item.status === 'matched').length;
+  elements.importSummary.textContent = `Total de transações: ${total}. Conciliadas: ${matched}. Pendentes: ${total - matched}.`;
+}
+
+function renderTransactions() {
+  elements.transactionsTable.innerHTML = '';
+  const term = elements.searchTransactions.value.toLowerCase();
+  const filter = elements.filterStatus.value;
+  const filtered = state.transactions.filter((item) => {
+    const matchesTerm = [item.description, item.account, item.debit, item.credit]
+      .join(' ')
+      .toLowerCase()
+      .includes(term);
+    const matchesStatus = filter === 'all' || item.status === filter;
+    return matchesTerm && matchesStatus;
+  });
+  const template = document.querySelector('#transaction-row-template');
+  filtered.forEach((transaction) => {
+    const row = template.content.cloneNode(true);
+    row.querySelector('[data-field="date"]').textContent = transaction.date ? transaction.date.toLocaleDateString('pt-BR') : '-';
+    row.querySelector('[data-field="description"]').textContent = transaction.description || '-';
+    row.querySelector('[data-field="debit"]').textContent = transaction.debit ? formatMoney(transaction.debit) : '-';
+    row.querySelector('[data-field="credit"]').textContent = transaction.credit ? formatMoney(transaction.credit) : '-';
+    row.querySelector('[data-field="balance"]').textContent = transaction.balance ? formatMoney(transaction.balance) : '-';
+    const statusCell = row.querySelector('[data-field="status"]');
+    statusCell.innerHTML = transaction.status === 'matched'
+      ? '<span class="status-pill status-matched">Conciliado</span>'
+      : '<span class="status-pill status-pending">Pendente</span>';
+    const accountInput = row.querySelector('.account-input');
+    accountInput.value = transaction.account || '';
+    accountInput.addEventListener('change', (event) => {
+      transaction.account = event.target.value;
+      transaction.status = transaction.account ? 'matched' : 'pending';
+      if (transaction.account && transaction.description) {
+        learnRule(transaction.description, transaction.account);
+      }
+      saveState();
+      renderTransactions();
+      renderSummary();
+    });
+    elements.transactionsTable.appendChild(row);
+  });
+}
+
+function renderAccounts() {
+  elements.accountsList.innerHTML = '';
+  state.accounts.forEach((account, index) => {
+    const tag = document.createElement('span');
+    tag.className = 'tag';
+    tag.textContent = account;
+    const remove = document.createElement('button');
+    remove.textContent = '×';
+    remove.addEventListener('click', () => {
+      state.accounts.splice(index, 1);
+      saveState();
+      renderAccounts();
+    });
+    tag.appendChild(remove);
+    elements.accountsList.appendChild(tag);
+  });
+}
+
+function learnRule(description, account) {
+  const existing = state.rules.find((rule) => rule.pattern === description && rule.account === account);
+  if (existing) return;
+  const pattern = description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
+  state.rules.unshift({ pattern, account, createdAt: new Date().toISOString() });
+  saveState();
+  renderRules();
+}
+
+function renderRules() {
+  elements.rulesList.innerHTML = '';
+  state.rules.forEach((rule, index) => {
+    const tag = document.createElement('span');
+    tag.className = 'tag';
+    tag.textContent = `${rule.pattern} → ${rule.account}`;
+    const remove = document.createElement('button');
+    remove.textContent = '×';
+    remove.addEventListener('click', () => {
+      state.rules.splice(index, 1);
+      saveState();
+      renderRules();
+      renderTransactions();
+    });
+    tag.appendChild(remove);
+    elements.rulesList.appendChild(tag);
+  });
+}
+
+function parseFiles(files) {
+  const tasks = Array.from(files).map((file) => file.text().then((content) => ({ file, content })));
+  Promise.all(tasks).then((results) => {
+    const parsed = [];
+    results.forEach(({ file, content }) => {
+      if (file.name.toLowerCase().endsWith('.ofx')) {
+        parsed.push(...parseOFX(content));
+      } else if (file.name.toLowerCase().endsWith('.json')) {
+        const data = JSON.parse(content);
+        if (Array.isArray(data)) {
+          parsed.push(...data.map((item) => ({
+            date: parseDate(item.date || item.data),
+            description: item.description || item.historico || item.memo,
+            debit: item.debit || 0,
+            credit: item.credit || 0,
+            balance: item.balance || null,
+          })));
+        }
+      } else {
+        const rows = parseCSV(content);
+        parsed.push(...normalizeTransactions(rows));
+      }
+    });
+    updateTransactions(parsed);
+  });
+}
+
+function handleAccountsImport(file) {
+  if (!file) return;
+  file.text().then((content) => {
+    const rows = parseCSV(content);
+    rows.slice(1).forEach((row) => {
+      const code = row[0];
+      const description = row[1];
+      if (code && description) {
+        state.accounts.push(`${code} - ${description}`);
+      }
+    });
+    saveState();
+    renderAccounts();
+  });
+}
+
+function reconcile() {
+  const toleranceDays = parseInt(elements.toleranceDays.value, 10) || 0;
+  const toleranceValue = parseFloat(elements.toleranceValue.value) || 0;
+  const matches = [];
+  const remainingLedger = [...state.ledgerEntries];
+  const remainingBank = [...state.transactions];
+
+  remainingBank.forEach((bankEntry) => {
+    const bankValue = bankEntry.credit - bankEntry.debit;
+    const bankDate = bankEntry.date;
+    let matchIndex = -1;
+    let matchDiff = Infinity;
+    remainingLedger.forEach((ledgerEntry, index) => {
+      const ledgerDate = ledgerEntry.date;
+      const diffDays = bankDate && ledgerDate ? Math.abs((bankDate - ledgerDate) / (1000 * 60 * 60 * 24)) : 999;
+      const diffValue = Math.abs(bankValue - ledgerEntry.value);
+      if (diffDays <= toleranceDays && diffValue <= toleranceValue && diffValue < matchDiff) {
+        matchIndex = index;
+        matchDiff = diffValue;
+      }
+    });
+    if (matchIndex >= 0) {
+      const ledgerEntry = remainingLedger.splice(matchIndex, 1)[0];
+      matches.push({ bankEntry, ledgerEntry, diff: matchDiff });
+      bankEntry.status = 'matched';
+      bankEntry.account = ledgerEntry.account;
+    }
+  });
+
+  state.transactions = remainingBank;
+  saveState();
+  renderTransactions();
+  renderSummary();
+  renderReconciliation(matches, remainingLedger);
+}
+
+function renderReconciliation(matches, remainingLedger) {
+  elements.reconciliationTable.innerHTML = '';
+  matches.forEach(({ bankEntry, ledgerEntry, diff }) => {
+    const row = document.createElement('tr');
+    row.innerHTML = `
+      <td>${bankEntry.description} (${formatMoney(bankEntry.credit - bankEntry.debit)})</td>
+      <td>${ledgerEntry.description} (${formatMoney(ledgerEntry.value)})</td>
+      <td>${formatMoney(diff)}</td>
+      <td><button class="secondary" data-action="unlink">Desfazer</button></td>
+    `;
+    row.querySelector('[data-action="unlink"]').addEventListener('click', () => {
+      bankEntry.status = 'pending';
+      bankEntry.account = '';
+      saveState();
+      renderTransactions();
+      renderSummary();
+    });
+    elements.reconciliationTable.appendChild(row);
+  });
+
+  remainingLedger.forEach((entry) => {
+    const row = document.createElement('tr');
+    row.innerHTML = `
+      <td>Sem match</td>
+      <td>${entry.description} (${formatMoney(entry.value)})</td>
+      <td>-</td>
+      <td>Revisar</td>
+    `;
+    elements.reconciliationTable.appendChild(row);
+  });
+
+  elements.reconciliationSummary.textContent = `Conciliados: ${matches.length}. Pendentes: ${remainingLedger.length}.`;
+}
+
+function handleLedgerImport(file) {
+  if (!file) return;
+  file.text().then((content) => {
+    const rows = parseCSV(content);
+    state.ledgerEntries = rows.slice(1).map((row) => ({
+      date: parseDate(row[0]),
+      description: row[1],
+      value: parseFloat(row[2].replace('.', '').replace(',', '.')),
+      account: row[3],
+    })).filter((entry) => entry.description);
+    saveState();
+  });
+}
+
+function exportData(type) {
+  const data = state.transactions.map((item) => ({
+    date: item.date ? item.date.toISOString().slice(0, 10) : '',
+    description: item.description,
+    debit: item.debit,
+    credit: item.credit,
+    balance: item.balance,
+    account: item.account,
+    status: item.status,
+  }));
+  if (type === 'json') {
+    downloadFile('extrato-unificado.json', JSON.stringify(data, null, 2), 'application/json');
+  } else {
+    const header = 'data,descricao,debito,credito,saldo,conta,status\n';
+    const rows = data.map((item) => (
+      `${item.date},"${item.description}",${item.debit},${item.credit},${item.balance ?? ''},"${item.account}",${item.status}`
+    )).join('\n');
+    downloadFile('extrato-unificado.csv', header + rows, 'text/csv');
+  }
+}
+
+function downloadFile(filename, content, type) {
+  const blob = new Blob([content], { type });
+  const url = URL.createObjectURL(blob);
+  const link = document.createElement('a');
+  link.href = url;
+  link.download = filename;
+  link.click();
+  URL.revokeObjectURL(url);
+}
+
+function loadSamples() {
+  Promise.all([
+    fetch('samples/extrato.csv').then((res) => res.text()),
+    fetch('samples/extrato.ofx').then((res) => res.text()),
+    fetch('samples/plano-contas.csv').then((res) => res.text()),
+    fetch('samples/contabilidade.csv').then((res) => res.text()),
+  ]).then(([csv, ofx, accounts, ledger]) => {
+    updateTransactions(normalizeTransactions(parseCSV(csv)));
+    updateTransactions(parseOFX(ofx));
+    handleAccountsImport(new File([accounts], 'plano-contas.csv'));
+    handleLedgerImport(new File([ledger], 'contabilidade.csv'));
+  }).catch((error) => {
+    console.error('Falha ao carregar amostras', error);
+  });
+}
+
+function resetData() {
+  state.transactions = [];
+  state.accounts = [];
+  state.rules = [];
+  state.ledgerEntries = [];
+  saveState();
+  renderTransactions();
+  renderAccounts();
+  renderRules();
+  renderSummary();
+  elements.reconciliationTable.innerHTML = '';
+  elements.reconciliationSummary.textContent = '';
+}
+
+function init() {
+  loadState();
+  renderAccounts();
+  renderRules();
+  renderTransactions();
+  renderSummary();
+
+  elements.parseFiles.addEventListener('click', () => {
+    if (!elements.fileInput.files.length) return;
+    state.company = elements.companyName.value;
+    state.bank = elements.bankName.value;
+    state.currency = elements.currency.value;
+    parseFiles(elements.fileInput.files);
+  });
+
+  elements.downloadUnified.addEventListener('click', () => exportData('csv'));
+  elements.accountsFile.addEventListener('change', (event) => handleAccountsImport(event.target.files[0]));
+
+  elements.addAccount.addEventListener('click', () => {
+    const value = elements.newAccount.value.trim();
+    if (!value) return;
+    state.accounts.push(value);
+    elements.newAccount.value = '';
+    saveState();
+    renderAccounts();
+  });
+
+  elements.addRule.addEventListener('click', () => {
+    const pattern = elements.rulePattern.value.trim();
+    const account = elements.ruleAccount.value.trim();
+    if (!pattern || !account) return;
+    state.rules.unshift({ pattern, account, createdAt: new Date().toISOString() });
+    elements.rulePattern.value = '';
+    elements.ruleAccount.value = '';
+    saveState();
+    renderRules();
+  });
+
+  elements.searchTransactions.addEventListener('input', renderTransactions);
+  elements.filterStatus.addEventListener('change', renderTransactions);
+
+  elements.ledgerInput.addEventListener('change', (event) => handleLedgerImport(event.target.files[0]));
+  elements.runReconciliation.addEventListener('click', reconcile);
+
+  elements.exportCsv.addEventListener('click', () => exportData('csv'));
+  elements.exportJson.addEventListener('click', () => exportData('json'));
+
+  elements.loadSamples.addEventListener('click', loadSamples);
+  elements.resetData.addEventListener('click', resetData);
+}
+
+init();
 
EOF
)
