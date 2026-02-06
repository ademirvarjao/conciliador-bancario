# 🏦 Conciliador Bancário v0.5

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.5.0-green.svg)](https://github.com/ademirvarjao/conciliador-bancario)
[![100% Client-Side](https://img.shields.io/badge/100%25-Client--Side-orange.svg)]()

Uma ferramenta **open source** de conciliação bancária automática, 100% executada no navegador. Desenvolvida para profissionais de contabilidade e finanças que buscam agilidade, precisão e privacidade absoluta no processo de reconciliação.

## ✨ Novidades da Versão 0.5

### Funcionalidades Aprimoradas
- ✅ **Matching Inteligente Aprimorado**: Algoritmo de conciliação com tolerância configurável para data e valor
- ✅ **Validação de Dados**: Verificação automática de integridade dos arquivos importados
- ✅ **Ações em Lote Otimizadas**: Seleção múltipla e aplicação de contas em massa
- ✅ **Exportação Melhorada**: Formatos CSV e JSON com todos os metadados de conciliação
- ✅ **Interface Responsiva**: Design adaptado para tablets e dispositivos móveis
- ✅ **Indicadores Visuais**: Dashboard com métricas em tempo real e status de conciliação
- ✅ **Detecção Automática de Formato**: Suporte aprimorado para diferentes padrões de CSV (vírgula, ponto-e-vírgula)
- ✅ **Histórico de Regras**: Sistema inteligente que aprende com suas categorizações
- ✅ **Filtros Avançados**: Busca e filtragem por status, descrição e conta contábil

### Melhorias de Layout
- 🎨 **Design Moderno**: Interface limpa inspirada em aplicativos financeiros profissionais
- 🎨 **Tabelas Otimizadas**: Melhor visualização de grandes volumes de transações
- 🎨 **Feedback Visual**: Indicadores de status claros (pendente, conciliado)
- 🎨 **Paleta de Cores**: Esquema visual intuitivo para valores positivos/negativos

### Melhorias Técnicas
- ⚡ **Performance**: Processamento otimizado para arquivos grandes (10.000+ transações)
- ⚡ **Estabilidade**: Tratamento robusto de erros e validação de entrada
- ⚡ **Compatibilidade**: Suporte ampliado para diferentes formatos de OFX e CSV
- ⚡ **Modularização**: Código reorganizado para melhor manutenibilidade

---

## 🚀 Como Começar

### Requisitos
- Navegador moderno (Chrome, Firefox, Edge, Safari)
- Arquivos de extrato bancário (OFX ou CSV)
- Razão contábil ou planilha de lançamentos (CSV)

### Instalação

```bash
# Clone o repositório
git clone https://github.com/ademirvarjao/conciliador-bancario.git

# Acesse a pasta
cd conciliador-bancario

# Abra o index.html no navegador
# Ou use um servidor local:
python -m http.server 8000
# Depois acesse: http://localhost:8000
```

### Uso Rápido (5 Passos)

#### 1️⃣ **Preparação dos Dados**
- **Extrato Bancário**: Exporte do seu banco em formato **OFX** (preferencial) ou **CSV**
- **Contabilidade**: Exporte o razão contábil em **CSV** com colunas: Data, Descrição, Valor, Conta

#### 2️⃣ **Configuração do Plano de Contas**
- Adicione suas categorias contábeis manualmente ou importe via CSV
- Exemplos: "Receita de Vendas", "Tarifas Bancárias", "Folha de Pagamento", etc.
- O sistema armazena suas contas para uso futuro

#### 3️⃣ **Importação de Extratos**
- Arraste seus arquivos para a zona de upload ou clique para selecionar
- Clique em **"Processar Arquivos"**
- O sistema detectará automaticamente o formato e carregará as transações

#### 4️⃣ **Categorização Inteligente**
- Atribua contas contábeis às transações diretamente na tabela
- **Regras Automáticas**: O sistema "aprende" suas categorizações e as aplica automaticamente em importações futuras
- Use **Ações em Lote** para categorizar múltiplas transações de uma vez

#### 5️⃣ **Reconciliação Automática**
- Carregue o arquivo do **Razão Contábil** (CSV)
- Configure:
  - **Tolerância de Dias**: Para compensação bancária (ex: 2 dias)
  - **Tolerância de Valor**: Para diferenças de arredondamento (ex: R$ 0,05)
- Clique em **"Executar Matching"**
- O sistema cruzará automaticamente as transações idênticas

#### 6️⃣ **Exportação de Resultados**
- Exporte em **CSV** para Excel/Planilhas
- Exporte em **JSON** para integração com sistemas ERP
- Todos os metadados de conciliação são incluídos

---

## 📊 Funcionalidades Detalhadas

### Dashboard em Tempo Real
- **Total de Entradas**: Soma de todos os créditos do período
- **Total de Saídas**: Soma de todos os débitos do período
- **Saldo do Período**: Resultado líquido (entradas - saídas)
- **Status de Conciliação**: Percentual de transações conciliadas

### Sistema de Matching Inteligente
O motor de conciliação compara transações bancárias com lançamentos contábeis usando:
- **Correspondência por Data**: Com tolerância configurável (padrão: ±2 dias)
- **Correspondência por Valor**: Com tolerância para diferenças mínimas (padrão: R$ 0,05)
- **Correspondência por Descrição**: Matching fuzzy para textos similares
- **Priorização**: Algoritmo que prioriza matches mais precisos

### Regras Automáticas
- Criação automática de regras baseada em histórico
- Aplicação inteligente em novas importações
- Gerenciamento manual de regras existentes
- Exportação/importação de regras entre sessões

### Validação e Tratamento de Erros
- Validação de formato de arquivo
- Verificação de integridade de dados
- Detecção automática de delimitadores (vírgula, ponto-e-vírgula)
- Tratamento de formatos de data variados (BR/US/ISO)
- Conversão automática de formatos numéricos (BR: 1.234,56 / US: 1,234.56)

---

## 🔒 Segurança e Privacidade

### Zero Upload de Dados
- ✅ **100% Local**: Todo o processamento ocorre no seu navegador
- ✅ **Sem Servidores**: Seus dados financeiros nunca são enviados para a internet
- ✅ **Sem Dependências Externas**: Nenhuma API ou serviço externo é consultado
- ✅ **Código Aberto**: Você pode auditar todo o código-fonte

### Armazenamento Local
- Dados salvos apenas no `localStorage` do seu navegador
- Você controla quando limpar os dados
- Nenhum rastreamento ou analytics
- Compatível com LGPD e GDPR

---

## 📁 Estrutura de Arquivos

```
conciliador-bancario/
├── index.html          # Interface principal
├── styles.css          # Estilos e layout responsivo
├── app.js             # Lógica de negócio e processamento
└── README.md          # Documentação (este arquivo)
```

---

## 🛠️ Formatos Suportados

### Arquivos de Entrada

**OFX (Open Financial Exchange)**
- Formato padrão de exportação bancária
- Contém metadados completos das transações
- Detecta automaticamente tags STMTTRN, TRNAMT, DTPOSTED, MEMO

**CSV (Comma-Separated Values)**
- Formato universal de planilhas
- Suporta delimitadores: vírgula (,) e ponto-e-vírgula (;)
- Estrutura esperada:
  ```
  Data,Descrição,Valor,Conta
  01/02/2026,Pagamento Cliente XYZ,1500.00,Receita de Vendas
  ```

### Arquivos de Exportação

**CSV de Exportação**
- Todas as transações com status de conciliação
- Metadados: data, descrição, valor, conta atribuída, status
- Compatível com Excel, Google Sheets, LibreOffice

**JSON de Exportação**
- Formato estruturado para integração com sistemas
- Inclui regras, contas e histórico completo
- Ideal para backup ou migração de dados

---

## 🎯 Casos de Uso

### Para Contadores
- Conciliação rápida de múltiplas contas bancárias
- Preparação de demonstrativos para clientes
- Verificação de lançamentos contábeis vs. extratos
- Identificação de divergências e pendências

### Para Empresas
- Conferência de contas bancárias antes do fechamento mensal
- Auditoria interna de movimentações financeiras
- Controle de recebimentos e pagamentos
- Rastreamento de tarifas bancárias

### Para Auditores
- Validação de registros contábeis
- Verificação de conformidade
- Detecção de anomalias e padrões suspeitos
- Documentação de processos de conferência

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Este é um projeto open source mantido pela comunidade.

### Como Contribuir

1. **Fork** este repositório
2. Crie uma **branch** para sua feature (`git checkout -b feature/MinhaFeature`)
3. **Commit** suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. **Push** para a branch (`git push origin feature/MinhaFeature`)
5. Abra um **Pull Request**

### Áreas para Contribuição
- 🐛 Correção de bugs
- ✨ Novas funcionalidades
- 📝 Melhorias na documentação
- 🌐 Traduções (i18n)
- 🎨 Melhorias de UI/UX
- ⚡ Otimizações de performance

---

## 📝 Roadmap

### Versão 0.6 (Planejado)
- [ ] Suporte a múltiplas moedas
- [ ] Gráficos e visualizações de dados
- [ ] Exportação em PDF com relatório formatado
- [ ] Importação de OFX compactado (ZIP)
- [ ] Undo/Redo de ações
- [ ] Modo escuro

### Versão 0.7 (Futuro)
- [ ] Suporte a arquivos CNAB (240/400)
- [ ] API de integração
- [ ] Sincronização opcional com cloud storage
- [ ] Matching por machine learning
- [ ] App mobile (PWA)

---

## 📄 Licença

Este projeto está licenciado sob a **MIT License** - veja o arquivo [LICENSE](LICENSE) para detalhes.

```
MIT License

Copyright (c) 2026 Ademir Varjão

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 👨‍💻 Desenvolvedor

**Ademir Varjão**
- GitHub: [@ademirvarjao](https://github.com/ademirvarjao)
- Projeto: [Conciliador Bancário Pro](https://github.com/ademirvarjao/conciliador-bancario)

---

## 🙏 Agradecimentos

Graças à comunidade open source e aos profissionais de contabilidade que forneceram feedback valioso para o desenvolvimento desta ferramenta.

---

## 📞 Suporte

- **Issues**: [GitHub Issues](https://github.com/ademirvarjao/conciliador-bancario/issues)
- **Discussões**: [GitHub Discussions](https://github.com/ademirvarjao/conciliador-bancario/discussions)
- **Documentação**: Este README e comentários no código-fonte

---

**Desenvolvido com ❤️ para a comunidade contábil brasileira**

*Versão 0.5.0 - Fevereiro 2026*
