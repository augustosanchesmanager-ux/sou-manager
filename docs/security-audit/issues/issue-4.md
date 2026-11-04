## Descrição do Problema
Existem arquivos locais na raiz do projeto contendo variáveis de ambiente e backups com chaves ativas (`secrets.env.txt` e `env.local.bak_bom.txt`). A verificação com `git check-ignore` confirmou que o `.gitignore` atual não cobre essas extensões.

## Por que é explorável
Em fluxos de trabalho locais, desenvolvedores executam rotineiramente comandos como `git add .` ou `git add -A`. A ausência de regras explícitas no `.gitignore` fatalmente levará à inclusão acidental desses arquivos no índice do Git.

## Evidência
```bash
git check-ignore secrets.env.txt env.local.bak_bom.txt
# Retorna código 1 (arquivos não estão ignorados pelo Git)
```

## Impacto
Risco iminente de novo vazamento de credenciais ativas para o histórico do repositório remoto.

## Sugestão de Correção
Incluir no arquivo `.gitignore`:
```gitignore
# Credenciais e backups locais
secrets.env.txt
*.bak_bom.txt
*.env.txt
```

## Critérios de Aceite
- [ ] `git check-ignore secrets.env.txt env.local.bak_bom.txt` retorna código 0
- [ ] Comandos `git status` não mostram arquivos de credenciais como untracked
