# SMG Frontend Core

Esta pasta representa o frontend `core` da SMG.

Responsabilidades:

- auth
- tenancy
- app resolution
- routing
- access control
- observability de plataforma

Regra principal:

- `core` pode centralizar autoridade
- `core` nao pode ser duplicado em tela, modulo ou componente de dominio
