# Conciliador Bancário Inteligente

Aplicativo executado 100% no navegador para importar extratos bancários, converter para um padrão único e conciliar com lançamentos contábeis. O sistema inclui aprendizado de regras por empresa, plano de contas, conversão OFX/CSV/JSON e conciliação automática.

## Recursos principais

- **Importação Flexível:**
  - **CSV:** Detecta automaticamente separadores (vírgula/ponto e vírgula) e formatos de número (brasileiro `1.000,00` ou internacional `1,000.00`).
  - **OFX:** Suporte robusto a datas e valores, ignorando metadados de fuso horário que causam erros.
  - **JSON:** Importação direta de arrays de objetos.
- **Plano de contas:** Importação via CSV e criação manual de contas na interface.
- **Regras inteligentes:** O sistema aprende a associar históricos (ex: "Pgto Energia") a contas contábeis (ex: "Despesas de Luz") e salva no seu navegador.
- **Conciliação automática:** Algoritmo que compara extrato vs. contabilidade com tolerância ajustável de dias e valores.
- **Notas de PDF:** Campo dedicado para documentar conversões manuais de extratos em PDF.
- **Privacidade:** Todos os dados ficam salvos apenas no seu `localStorage`. Nada é enviado para servidores externos.

## Como executar

Simplesmente abra o arquivo `index.html` no seu navegador.

Para uma melhor experiência (e evitar bloqueios de segurança de alguns navegadores ao carregar módulos ou usar certas APIs), recomenda-se um servidor local simples:

1. Tenha o Python instalado.
2. Na pasta do projeto, rode:
   ```bash
   python -m http.server 8000
