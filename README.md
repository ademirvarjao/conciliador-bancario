# 🏦 Conciliador Bancário v0.7

**Ferramenta open source de conciliação bancária automática**

100% executada no navegador • Privacidade total • Sem backend

[![Licença MIT](https://img.shields.io/badge/Licença-MIT-blue.svg)](LICENSE)
[![Versão](https://img.shields.io/badge/Versão-0.7.0-green.svg)](https://github.com/ademirvarjao/conciliador-bancario)

---

## ✨ Novidades v0.7

- ✅ **Correção crítica na importação de CSV**
- 📄 **Suporte a arquivos PDF** (texto nativo)
- 🔍 **OCR para PDFs digitalizados** (arquivos em imagem)
- 🧠 **Detecção inteligente de colunas CSV**
- ⚡ **Melhor tratamento de erros e validações**

---

## 🚀 Funcionalidades

### Importação de Dados

- ✅ **OFX** - Formato padrão de extratos bancários
- ✅ **CSV** - Detecção automática de colunas (data, descrição, valor)
- ✅ **JSON** - Importação e exportação de dados estruturados
- ✅ **PDF** - Extração de texto de PDFs nativos
- 🆕 **PDF com OCR** - Processa PDFs digitalizados/imagem (Tesseract.js)

### Processamento

- 🎯 **Matching automático** com razão contábil
- 📊 **Dashboard com métricas** em tempo real
- 🏷️ **Regras inteligentes** de classificação
- 🔍 **Busca e filtros** avançados
- ⚙️ **Tolerâncias configuráveis** (dias e valor)

### Gestão

- 💼 **Plano de contas** personalizável
- 🔄 **Ações em lote** (atribuição de contas, exclusão)
- 💾 **Exportação** para CSV e JSON
- 💾 **Persistência local** automática (LocalStorage)
- 🌐 **Suporte a múltiplas moedas** (BRL, USD, EUR)

---

## 💻 Como Usar

### 1️⃣ Acessar a Aplicação

Basta abrir o arquivo `index.html` em qualquer navegador moderno:

```bash
# Clone o repositório
git clone https://github.com/ademirvarjao/conciliador-bancario.git

# Entre na pasta
cd conciliador-bancario

# Abra o index.html no navegador
# - No Windows: start index.html
# - No Linux: xdg-open index.html  
# - No Mac: open index.html
```

Ou use um servidor local:

```bash
# Python 3
python -m http.server 8000

# Node.js (npx)
npx serve

# Depois acesse: http://localhost:8000
```

### 2️⃣ Importar Extratos Bancários

#### Formatos Suportados

**CSV** - Detecção automática de colunas:
```csv
Data;Descrição;Valor
01/02/2026;Pagamento Cliente ABC;1500,00
02/02/2026;Fornecedor XYZ;-800,50
```

**OFX** - Formato bancário padrão:
```xml
<OFX>
  <BANKTRANLIST>
    <STMTTRN>
      <DTPOSTED>20260201</DTPOSTED>
      <TRNAMT>1500.00</TRNAMT>
      <MEMO>Pagamento Cliente ABC</MEMO>
    </STMTTRN>
  </BANKTRANLIST>
</OFX>
```

**JSON** - Formato estruturado:
```json
[
  {
    "date": "2026-02-01",
    "description": "Pagamento Cliente ABC",
    "amount": 1500.00,
    "account": "Receita de Vendas"
  }
]
```

**PDF** - Dois modos:

1. **Texto Nativo** (padrão): Para PDFs gerados digitalmente
   - Mais rápido e preciso
   - Apenas clique e arraste o arquivo

2. **OCR** (Tesseract): Para PDFs digitalizados/imagem
   - Ative o toggle "🔍 OCR para PDFs em Imagem"
   - Processamento pode demorar (depende do tamanho)
   - Reconhece texto em português

### 3️⃣ Configurar Plano de Contas

Adicione suas contas contábeis:
- Digite o nome da conta e clique em "+"
- Ou importe via CSV (uma conta por linha)

### 4️⃣ Carregar Razão Contábil

Importe o CSV do seu sistema contábil:
```csv
Data;Descrição;Valor;Conta
01/02/2026;Cliente ABC;1500,00;Receita de Vendas
```

### 5️⃣ Executar Matching

Clique em "🎯 Executar Matching" para conciliar automaticamente.

Parâmetros:
- **Tolerância de Dias**: Diferença máxima entre datas
- **Tolerância de Valor**: Diferença máxima entre valores (R$)

### 6️⃣ Revisar e Ajustar

- Classifique manualmente transações pendentes
- Use ações em lote para agilizar
- O sistema cria regras automáticas baseadas nas suas escolhas

### 7️⃣ Exportar Resultados

Exporte a conciliação em:
- **CSV** - Para planilhas
- **JSON** - Para outros sistemas

---

## 🔧 Tecnologias

- **Vanilla JavaScript** (ES6+)
- **HTML5 + CSS3**
- **PDF.js** - Extração de texto de PDFs
- **Tesseract.js** - OCR (reconhecimento ótico de caracteres)
- **LocalStorage API** - Persistência local
- **File API** - Manipulação de arquivos

---

## 🔒 Privacidade e Segurança

✅ **100% Local** - Todo processamento ocorre no navegador  
✅ **Sem Upload** - Seus dados NUNCA saem da sua máquina  
✅ **Sem Backend** - Não há servidor ou banco de dados remoto  
✅ **Open Source** - Código totalmente auditável  

---

## 🛠️ Detecção Automática de CSV

O sistema detecta automaticamente:

1. **Delimitador** - Vírgula ou ponto-e-vírgula
2. **Cabeçalho** - Identifica se primeira linha é cabeçalho
3. **Colunas**:
   - **Data**: Busca padrões DD/MM/YYYY, YYYYMMDD
   - **Descrição**: Identifica coluna de texto longo
   - **Valor**: Reconhece formatos BR (1.234,56) e EN (1,234.56)

### Exemplos de Formatos Suportados

```csv
# Formato 1: Com cabeçalho explícito
Data;Histórico;Valor;Conta
01/01/2026;Pagamento;1.500,00;Receita

# Formato 2: Sem cabeçalho
01/01/2026;Pagamento;1500.00
02/01/2026;Fornecedor;-800.50

# Formato 3: Ordem diferente (detecta automaticamente)
Valor,Data,Descrição
1500.00,2026-01-01,Pagamento Cliente
```

---

## 📄 Processamento de PDF

### Modo Texto (Padrão)

- Para PDFs gerados digitalmente
- Rápido e preciso
- Extração automática de datas, descrições e valores

### Modo OCR (Opcional)

**Quando usar:**
- PDF é uma imagem digitalizada
- Extrato foi escaneado
- PDF não permite seleção de texto

**Como ativar:**
1. Ative o toggle "🔍 OCR para PDFs em Imagem"
2. Arraste o PDF para a área de upload
3. Aguarde o processamento (pode demorar)

**Performance:**
- Carrega bibliotecas sob demanda
- Processa página por página
- Mostra progresso em tempo real

---

## 📊 Algoritmo de Matching

O motor de conciliação usa:

1. **Tolerância de Data** (30% do score)
2. **Tolerância de Valor** (50% do score)
3. **Similaridade de Descrição** (20% do score - Levenshtein)

Score mínimo para match: **70%**

---

## 🐛 Problemas Conhecidos e Soluções

### CSV não importa

✅ **Solucionado na v0.7**
- Detecção inteligente de colunas
- Suporte a múltiplos formatos
- Melhor tratamento de erros

### PDF vazio ou sem transações

- Verifique se o PDF contém texto selecionável
- Se for imagem/scan, ative o OCR
- Formatos de extrato muito customizados podem não ser reconhecidos

### OCR muito lento

- Normal para PDFs grandes
- Carrega bibliotecas apenas quando necessário
- Processa página por página para evitar travamento

---

## 🛣️ Roadmap

- [ ] Suporte a mais formatos de extrato
- [ ] Melhorias no OCR (mais idiomas)
- [ ] Exportação para Excel (XLSX)
- [ ] Gráficos e relatórios
- [ ] Importação de múltiplos bancos simultaneamente
- [ ] Machine learning para melhorar matching

---

## 🤝 Contribuindo

Contribuições são bem-vindas!

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

---

## 📝 Licença

MIT License - veja [LICENSE](LICENSE) para detalhes.

---

## ✉️ Contato

**Ademir Varjão**

- GitHub: [@ademirvarjao](https://github.com/ademirvarjao)
- Email: ademirvarjao@gmail.com

---

## 🔖 Changelog

### v0.7.0 (06/02/2026)
- ✅ Corrigida importação de CSV com detecção inteligente de colunas
- 🆕 Adicionado suporte a arquivos PDF
- 🔍 Implementado OCR para PDFs digitalizados (Tesseract.js)
- ⚡ Melhorado tratamento de erros
- 📊 Validações mais robustas

### v0.6.0 (Anterior)
- Layout tradicional e limpo
- Sistema de notificações toast
- Suporte a múltiplas moedas
- Performance otimizada
- Melhor tratamento de erros

---

<div align="center">
  <strong>Desenvolvido com ❤️ para a comunidade contábil brasileira</strong>
</div>
