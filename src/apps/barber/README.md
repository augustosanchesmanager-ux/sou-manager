# SMG Barber App

Esta pasta representa o dominio `barber` dentro da arquitetura multiapp da SMG.

Responsabilidades:

- modulos do `barber`
- paginas do `barber`
- manifests do `barber`
- contratos app-specific do `barber`

Regra principal:

- `barber` consome o `core`
- `barber` pode consumir `shared`
- `barber` nao deve voltar a ser o centro estrutural implicito da plataforma
