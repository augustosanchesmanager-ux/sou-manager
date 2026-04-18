# SMG Frontend Shared

Esta pasta representa o frontend `shared` reutilizavel da SMG.

Responsabilidades:

- UI reutilizavel
- hooks reutilizaveis
- helpers de apresentacao
- services compartilhados sem autoridade de contexto

Regra principal:

- `shared` pode ser consumido por apps diferentes
- `shared` nao decide `app`, `tenant`, `schema` ou excecoes de role
