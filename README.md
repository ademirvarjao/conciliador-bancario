# Conciliador Bancário Pro v2

O **Conciliador Bancário Pro** é uma ferramenta de código aberto, 100% executada no navegador, projetada para simplificar a conferência entre o seu extrato bancário e a sua contabilidade interna. 

## 🚀 Como Começar (Passo a Passo)

### 1. Preparação dos Dados
* **Extrato:** Exporte o extrato do seu banco nos formatos **OFX** (preferencial) ou **CSV**.
* **Contabilidade:** Exporte o seu razão contábil ou planilha de lançamentos em **CSV** (Colunas: Data, Descrição, Valor, Conta).

### 2. Configuração Inicial
* Abra o `index.html` em qualquer navegador moderno.
* No campo **Plano de Contas**, adicione as categorias que você utiliza (ex: "Receita de Vendas", "Tarifas Bancárias", "Energia Elétrica").
* *Dica:* Você pode importar um CSV com sua lista de contas para ganhar tempo.

### 3. Importação e Processamento
* Arraste seus arquivos de extrato para a **Zona de Upload**.
* Clique em **Processar Arquivos**. O sistema irá ler os dados e tentar categorizar automaticamente com base em suas regras anteriores.

### 4. Categorização e Regras
* Para transações pendentes, selecione a conta contábil diretamente na tabela.
* **Regras Inteligentes:** Sempre que você atribui uma conta a uma descrição, o sistema "aprende" e aplicará automaticamente essa conta em importações futuras.
* Use as **Ações em Lote** para selecionar várias linhas e aplicar uma conta de uma só vez.

### 5. Reconciliação Automática (Matching)
* Carregue o seu arquivo de **Razão Contábil**.
* Defina a **Tolerância de Dias** (ex: 2 dias para compensação bancária) e **Tolerância de Valor** (ex: R$ 0,05 para diferenças de arredondamento).
* Clique em **Executar Matching**. O sistema cruzará os dados e marcará como "Conciliado" tudo o que for idêntico nos dois registros.

### 6. Exportação
* Ao final do processo, exporte o resultado em **CSV** ou **JSON** para importar de volta para o seu ERP ou enviar para o seu contador.

## 🔒 Segurança e Privacidade
* **Zero Servidor:** Seus dados financeiros nunca saem do seu computador. O processamento é local.
* **Armazenamento Local:** As configurações e transações ficam salvas no `localStorage` do seu próprio navegador.

---
*Desenvolvido para profissionais que buscam agilidade sem abrir mão da privacidade.*
