 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/README.md b/README.md
index 05d96494efaefbba27aea6494dd492914ab190d1..0db55b3afc543329e8d514c04afc663f966d9026 100644
--- a/README.md
+++ b/README.md
@@ -1 +1,61 @@
-# conciliador-bancario
\ No newline at end of file
+# Conciliador Bancário Inteligente
+
+Aplicativo 100% no navegador para importar extratos bancários, converter para um padrão único e conciliar com lançamentos contábeis. O sistema inclui aprendizado de regras por empresa, plano de contas, conversão OFX/CSV/JSON, exportação e exemplos prontos para teste.
+
+## Recursos principais
+
+- **Importação multiformato:** CSV, OFX e JSON com unificação automática de colunas (data, débito, crédito, histórico, saldo).
+- **Conversão de PDF:** fluxo guiado para converter PDF externo em CSV (copie o trecho do PDF para registrar a conversão e depois importe o CSV).
+- **Plano de contas:** importação em CSV e criação manual de contas.
+- **Regras inteligentes:** associe históricos a contas e deixe o sistema aprender com a empresa (armazenado no navegador).
+- **Conciliação automática:** comparação de extratos com lançamentos contábeis usando tolerâncias de data e valor.
+- **Exportação:** CSV ou JSON do extrato unificado.
+
+## Como executar
+
+1. Inicie um servidor local (recomendado para carregar amostras):
+   ```bash
+   python -m http.server 8000
+   ```
+2. Abra `http://localhost:8000` no navegador.
+3. Clique em **Carregar amostras** para testar com arquivos fictícios.
+
+## Formatos aceitos
+
+### Extratos (CSV)
+
+Cabeçalhos aceitos (variações são reconhecidas):
+
+```
+data,descricao,debito,credito,saldo
+```
+
+### OFX
+
+Arquivos `.ofx` padrão com tags `DTPOSTED`, `TRNAMT`, `NAME`/`MEMO`.
+
+### Lançamentos contábeis (CSV)
+
+```
+data,descricao,valor,conta
+```
+
+### Plano de contas (CSV)
+
+```
+codigo,descricao,tipo
+```
+
+## Amostras
+
+Os arquivos na pasta `samples/` permitem testar o fluxo completo:
+
+- `samples/extrato.csv`
+- `samples/extrato.ofx`
+- `samples/plano-contas.csv`
+- `samples/contabilidade.csv`
+
+## Observações importantes
+
+- As regras e dados ficam em **localStorage**. Para uso corporativo, exporte e mantenha backups.
+- Conciliações automáticas devem ser revisadas por um contador responsável.
 
EOF
)
