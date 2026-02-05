<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Conciliador Bancário Pro</title>
  <link rel="stylesheet" href="styles.css" />
  </head>
<body>
  <div class="app-container">
    <header class="app-header">
      <div class="header-brand">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="brand-icon"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
        <div>
          <h1>Conciliador Pro</h1>
          <p>Painel de conciliação inteligente</p>
        </div>
      </div>
      <div class="header-actions">
        <button id="load-samples" class="btn btn-outline">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
          Carregar amostras
        </button>
        <button id="reset-data" class="btn btn-danger btn-outline">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          Limpar dados
        </button>
      </div>
    </header>

    <main class="app-content">
      
      <section class="card highlight-card">
        <div class="card-header">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="section-icon"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/></svg>
          <h2>1. Central de Importação</h2>
        </div>
        <div class="card-body">
          <div class="grid two-columns-sidebar-right">
            <div class="upload-zone-container">
              <label for="file-input" class="upload-zone">
                <input id="file-input" type="file" multiple hidden />
                <div class="upload-content">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/></svg>
                  <span>Clique ou arraste arquivos OFX, CSV ou JSON aqui</span>
                  <small>Detecção automática de formatos e moedas.</small>
                </div>
              </label>
              <div id="import-summary" class="banner banner-info hidden">Aguardando arquivos...</div>
            </div>

            <div class="form-group">
               <label for="pdf-notes">Notas de PDF (Opcional)</label>
               <textarea id="pdf-notes" rows="6" class="form-control" placeholder="Cole aqui trechos para documentação..."></textarea>
            </div>
          </div>

          <div class="grid three-columns mt-6">
            <div class="form-group">
              <label for="company-name">Empresa</label>
              <input id="company-name" type="text" class="form-control" placeholder="Ex: Minha Loja LTDA" />
            </div>
            <div class="form-group">
              <label for="bank-name">Banco</label>
              <input id="bank-name" type="text" class="form-control" placeholder="Ex: Itaú" />
            </div>
            <div class="form-group">
              <label for="currency">Moeda Visualização</label>
              <select id="currency" class="form-control form-select">
                <option value="BRL" selected>BRL (R$)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
          </div>

          <div class="actions-bar mt-6">
            <button id="parse-files" class="btn btn-primary btn-lg">Processar Arquivos</button>
            <button id="download-unified" class="btn btn-secondary">Baixar Unificado</button>
          </div>
        </div>
      </section>

      <div class="grid two-columns">
        <section class="card">
          <div class="card-header">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="section-icon"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
            <h2>2. Plano de Contas</h2>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label for="accounts-file" class="file-upload-label">
                <span>Importar CSV</span>
                <input id="accounts-file" type="file" class="form-control-file" />
              </label>
            </div>
            <div class="input-group mt-4">
              <input id="new-account" type="text" class="form-control" placeholder="Ex: 1.1.1 - Banco Itaú" />
              <button id="add-account" class="btn btn-secondary">Adicionar</button>
            </div>
            <div class="tags-container" id="accounts-list"></div>
          </div>
        </section>

        <section class="card">
          <div class="card-header">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="section-icon"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>
            <h2>3. Regras Inteligentes</h2>
          </div>
          <div class="card-body">
            <div class="grid two-columns-tight">
              <div class="form-group">
                <label for="rule-pattern">Contém no Histórico</label>
                <input id="rule-pattern" type="text" class="form-control" placeholder="Ex: PIX|TAR" />
              </div>
              <div class="form-group">
                <label for="rule-account">Conta Destino</label>
                <input id="rule-account" type="text" class="form-control" placeholder="Ex: Tarifas" />
              </div>
            </div>
            <button id="add-rule" class="btn btn-primary w-full mt-4">Salvar Regra</button>
            <div id="rules-list" class="tags-container mt-4"></div>
          </div>
        </section>
      </div>

      <section class="card card-full-width">
        <div class="card-header header-with-controls">
          <div class="header-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="section-icon"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
            <h2>4. Transações Unificadas</h2>
          </div>
          <div class="table-controls">
            <div class="search-box">
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="search-icon"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/></svg>
               <input id="search-transactions" type="search" class="form-control" placeholder="Buscar..." />
            </div>
            <select id="filter-status" class="form-control form-select">
              <option value="all">Todas</option>
              <option value="matched">Conciliadas</option>
              <option value="pending">Pendentes</option>
            </select>
          </div>
        </div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table id="transactions-table" class="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th class="text-right">Débito</th>
                  <th class="text-right">Crédito</th>
                  <th class="text-right">Saldo</th>
                  <th style="width: 250px;">Conta Contábil</th>
                  <th class="text-center">Status</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-header">
           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="section-icon"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8"/><path d="M9 7L4 20"/><path d="M15 7l5 13"/></svg>
          <h2>5. Motor de Conciliação</h2>
        </div>
        <div class="card-body">
          <div class="grid two-columns-sidebar-left align-end">
             <div class="form-group">
               <label class="file-upload-label display-block">
                 <span>Carregar Razão Contábil (CSV)</span>
                 <input id="ledger-input" type="file" class="form-control-file" />
               </label>
               <small class="hint">Data, Descrição, Valor, Conta</small>
            </div>
            
            <div class="reconciliation-controls">
               <div class="form-group">
                  <label for="tolerance-days">Tolerância Dias</label>
                  <input id="tolerance-days" type="number" min="0" value="2" class="form-control" />
               </div>
               <div class="form-group">
                  <label for="tolerance-value">Tolerância Valor</label>
                  <input id="tolerance-value" type="number" min="0" step="0.01" value="0.05" class="form-control" />
               </div>
                <button id="run-reconciliation" class="btn btn-success btn-lg">Conciliar Agora</button>
            </div>
          </div>

           <div id="reconciliation-summary" class="banner banner-warning hidden mt-6"></div>

          <div class="table-responsive mt-6">
            <table id="reconciliation-table" class="data-table">
              <thead>
                <tr>
                  <th>Banco</th>
                  <th>Contabilidade</th>
                  <th class="text-right">Diferença</th>
                  <th class="text-center">Ação</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="card card-compact align-center">
         <div class="card-header">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="section-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
            <h2>Exportar Dados Finais</h2>
         </div>
        <div class="card-body actions-bar">
          <button id="export-csv" class="btn btn-primary">Download CSV</button>
          <button id="export-json" class="btn btn-outline">Download JSON</button>
        </div>
      </section>

    </main>

    <footer class="app-footer">
      <p>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        Seus dados são processados localmente e salvos no navegador.
      </p>
    </footer>
  </div>

  <template id="transaction-row-template">
    <tr>
      <td data-field="date" class="text-nowrap"></td>
      <td data-field="description" class="text-truncate" style="max-width: 250px;"></td>
      <td data-field="debit" class="text-right text-danger font-medium"></td>
      <td data-field="credit" class="text-right text-success font-medium"></td>
      <td data-field="balance" class="text-right font-medium"></td>
      <td>
        <input class="account-input form-control form-control-sm" type="text" placeholder="Classificar..." />
      </td>
      <td data-field="status" class="text-center"></td>
    </tr>
  </template>

  <script src="app.js"></script>
</body>
</html>
