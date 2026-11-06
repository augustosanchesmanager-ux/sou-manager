# SMG Barber — Guia do Desenvolvedor (Public API & Webhooks)

> **Versão da API:** v1.0.0 (Fase 8 — Commercial Scalability)  
> **Especificação OpenAPI:** [`docs/api/openapi.yaml`](./openapi.yaml)  
> **Público-alvo:** Desenvolvedores de parceiros, ecossistemas de barbearias, desenvolvedores de totens, CRMs e ERPs integrados.

---

## 1. Visão Geral & Princípios Arquiteturais

A **SMG Barber Public API** permite integrar sistemas externos de forma autônoma e segura ao coração operacional da barbearia.

### Pilares Fundamentais:
1. **Isolamento Multi-Tenant Estrito:** Todas as operações são vinculadas de forma imutável ao `tenant_id` da barbearia proprietária da chave. É matematicamente impossível acessar ou alterar registros de outros estabelecimentos.
2. **Derivação Autoritativa de Preços (Resíduo Zero):** Ao abrir comandas, os preços de serviços e produtos são consultados e consolidados autoritativamente pela plataforma, assegurando paridade contábil estrita ($\Delta = \text{R\$} 0,00$) e cumprimento do **ADR-001**.
3. **Segurança Criptográfica em Repouso e Trânsito:** Chaves de API nunca são armazenadas em texto plano no banco de dados (apenas seu digest SHA-256). Disparos de webhooks utilizam assinaturas criptográficas `HMAC-SHA256` com proteção contra ataques de repetição (*replay attacks*).

---

## 2. Ambientes & Formato de Chaves

A plataforma disponibiliza dois ambientes isolados:

| Ambiente | Host Base | Prefixo da Chave | Finalidade |
|----------|-----------|------------------|------------|
| **Sandbox / Teste** | `https://sandbox.api.soumanager.com` | `smg_test_` | Homologação, testes e simulação de agendamentos/comandas |
| **Produção (Live)** | `https://api.soumanager.com` | `smg_live_` | Operação em tempo real na barbearia |

> ⚠️ **Atenção:** Chaves com prefixo `smg_test_` são terminantemente rejeitadas nos servidores de produção e vice-versa.

---

## 3. Autenticação & Escopos RBAC

Todas as requisições autenticadas devem incluir a API Key em um dos dois formatos suportados de cabeçalho HTTP:

```http
Authorization: Bearer smg_live_32byteshexadecimaloubase62...
```
*ou*
```http
X-API-Key: smg_live_32byteshexadecimaloubase62...
```

### Matriz de Escopos Sancionados

| Escopo | Permissão Concedida | Endpoints Associados |
|--------|---------------------|----------------------|
| `appointments:read` | Leitura e filtros de agendamentos | `GET /v1/appointments` |
| `appointments:write` | Criação e cancelamento de agendamentos | `POST /v1/appointments` |
| `comandas:read` | Consulta de comandas e itens consumidos | `GET /v1/comandas` |
| `comandas:write` | Abertura e inserção de itens em comandas | `POST /v1/comandas` |
| `services:read` | Consulta ao catálogo de serviços vigentes | `GET /v1/services` |
| `products:read` | Consulta ao catálogo de produtos e estoque | `GET /v1/products` |
| `catalog:read` | Escopo guarda-chuva para serviços e produtos | `GET /v1/services`, `GET /v1/products` |

---

## 4. Endpoints Principais & Exemplos Práticos

### 4.1 Checagem de Conectividade & Validação de Chave

#### `GET /v1/health`
Retorna a integridade do gateway. Não exige autenticação.
```bash
curl -X GET https://api.soumanager.com/v1/health
```

#### `GET /v1/auth/verify`
Inspeciona a chave em uso, seu tenant correspondente e escopos ativos.
```bash
curl -X GET https://api.soumanager.com/v1/auth/verify \
  -H "Authorization: Bearer smg_live_sua_chave_aqui"
```

---

### 4.2 Agendamentos (`/v1/appointments`)

#### Listar Agendamentos de uma Data
```bash
curl -X GET "https://api.soumanager.com/v1/appointments?date=2026-11-06&limit=20" \
  -H "Authorization: Bearer smg_live_sua_chave_aqui"
```

#### Criar Novo Agendamento (com Bloqueio Anti-Sobrecarga)
A API valida em tempo real se o profissional ou o cliente já possuem horário conflitante no mesmo tenant.

```bash
curl -X POST https://api.soumanager.com/v1/appointments \
  -H "Authorization: Bearer smg_live_sua_chave_aqui" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Carlos Eduardo",
    "customer_phone": "11988887777",
    "date": "2026-11-07",
    "start_time": "14:30",
    "duration_minutes": 45,
    "total_price": 60.00,
    "notes": "Agendamento realizado via App do Parceiro"
  }'
```

---

### 4.3 Comandas (`/v1/comandas`)

#### Abrir Comanda no Balcão PDV
Os itens podem referenciar diretamente `service_id` ou `product_id`. Se informados, seus preços oficiais e nomes são obtidos diretamente do catálogo do tenant.

```bash
curl -X POST https://api.soumanager.com/v1/comandas \
  -H "Authorization: Bearer smg_live_sua_chave_aqui" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Marcos Vinicius",
    "notes": "Comanda aberta via totem de recepção",
    "items": [
      {
        "service_id": "a1111111-2222-3333-4444-555555555555",
        "quantity": 1
      },
      {
        "name": "Pomada Efeito Seco",
        "quantity": 1,
        "unit_price": 45.00
      }
    ]
  }'
```

---

### 4.4 Catálogo de Serviços e Produtos

#### Listar Serviços Ativos
```bash
curl -X GET "https://api.soumanager.com/v1/services?category=Cabelo" \
  -H "Authorization: Bearer smg_live_sua_chave_aqui"
```

#### Listar Produtos em Estoque
```bash
curl -X GET "https://api.soumanager.com/v1/products" \
  -H "Authorization: Bearer smg_live_sua_chave_aqui"
```

---

## 5. Exemplos de Código para Integração

### Exemplo em TypeScript / JavaScript (Node.js 18+ ou Navegador)

```typescript
const SMG_BASE_URL = 'https://api.soumanager.com';
const API_KEY = process.env.SMG_API_KEY!;

async function fetchAppointments(date: string) {
  const url = `${SMG_BASE_URL}/v1/appointments?date=${encodeURIComponent(date)}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Erro na SMG API (${response.status}): ${errorData.error?.message}`);
  }

  const { data, pagination } = await response.json();
  return { appointments: data, total: pagination.total };
}
```

### Exemplo em Python (requests)

```python
import os
import requests

SMG_BASE_URL = "https://api.soumanager.com"
API_KEY = os.environ.get("SMG_API_KEY")

def create_appointment(customer_name: str, date: str, start_time: str, duration: int):
    url = f"{SMG_BASE_URL}/v1/appointments"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "customer_name": customer_name,
        "date": date,
        "start_time": start_time,
        "duration_minutes": duration,
        "notes": "Criado via script Python"
    }
    
    response = requests.post(url, json=payload, headers=headers, timeout=10)
    response.raise_for_status()
    return response.json()["data"]
```

---

## 6. Guia de Webhooks (Disparos Assíncronos)

Quando eventos operacionais acontecem (ex: agendamento criado, comanda fechada), o sistema despacha um payload JSON via HTTP POST para o endpoint cadastrado na assinatura da barbearia.

### Cabeçalhos Enviados em Cada Disparo:
- `Content-Type: application/json`
- `User-Agent: SMG-Webhook-Dispatcher/1.0`
- `X-SMG-Delivery-Id: <UUID da Entrega>`
- `X-SMG-Event: <tipo_do_evento>` (ex: `appointment.created`, `comanda.closed`)
- `X-SMG-Signature: t={timestamp},v1={digestHex}`

---

### Como Validar a Assinatura Criptográfica

Para assegurar que a requisição partiu legitimamente dos servidores da SMG e não sofreu adulteração em trânsito:

1. Extraia o timestamp `t` e o hash `v1` do cabeçalho `X-SMG-Signature`.
2. Verifique se o timestamp não está defasado em mais de **300 segundos (5 minutos)** em relação ao relógio do seu servidor para se proteger contra **replay attacks**.
3. Concatene o timestamp e o corpo cru (raw body) da requisição: `${t}.${rawBody}`.
4. Calcule o hash HMAC-SHA256 usando o seu `webhook_secret`.
5. Compare o digest gerado com o `v1` usando uma comparação resistente a ataques de temporização (*timing-safe comparison*).

#### Exemplo de Verificação em Node.js / TypeScript:

```typescript
import crypto from 'node:crypto';

function verifySmgSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds: number = 300
): boolean {
  const parts = signatureHeader.split(',').map((p) => p.trim());
  let timestampStr: string | null = null;
  let digestHex: string | null = null;

  for (const part of parts) {
    if (part.startsWith('t=')) timestampStr = part.substring(2);
    if (part.startsWith('v1=')) digestHex = part.substring(3);
  }

  if (!timestampStr || !digestHex) return false;

  const timestamp = parseInt(timestampStr, 10);
  const now = Math.floor(Date.now() / 1000);

  // Proteção contra Replay Attack
  if (Math.abs(now - timestamp) > toleranceSeconds) {
    return false;
  }

  const expectedContent = `${timestamp}.${rawBody}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(expectedContent);
  const calculatedHex = hmac.digest('hex');

  // Comparação em tempo constante
  return crypto.timingSafeEqual(
    Buffer.from(digestHex, 'hex'),
    Buffer.from(calculatedHex, 'hex')
  );
}
```

#### Exemplo de Verificação em Python (FastAPI / Flask):

```python
import hmac
import hashlib
import time

def verify_smg_signature(raw_body: bytes, signature_header: str, secret: str, tolerance_seconds: int = 300) -> bool:
    try:
        parts = dict(item.split("=") for item in signature_header.split(","))
        timestamp = int(parts.get("t", 0))
        received_digest = parts.get("v1", "")
    except Exception:
        return False

    now = int(time.time())
    if abs(now - timestamp) > tolerance_seconds:
        return False  # Replay attack mitigado

    signed_payload = f"{timestamp}.".encode("utf-8") + raw_body
    calculated_digest = hmac.new(
        secret.encode("utf-8"),
        signed_payload,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(received_digest.lower(), calculated_digest.lower())
```

---

### Política de Retries (Backoff Exponencial)

Se o servidor do parceiro retornar status $\ge 300$, timeout (limite de 8 segundos) ou falha de conexão, a SMG re-tentará o envio automaticamente seguindo a escala:

- **1ª Falha:** Retry após $+1\text{ minuto}$
- **2ª Falha:** Retry após $+5\text{ minutos}$
- **3ª Falha:** Retry após $+15\text{ minutos}$
- **4ª Falha:** Retry após $+1\text{ hora}$
- **5ª Falha:** Retry após $+6\text{ horas}$
- **$\ge 6$ Falhas:** O status é alterado permanentemente para `failed` e novas tentativas automáticas são interrompidas.

---

## 7. Códigos de Erro Padronizados

Todas as respostas de erro seguem o padrão JSON canônico:

```json
{
  "error": {
    "code": "INSUFFICIENT_SCOPE",
    "message": "A chave informada não possui o escopo appointments:write necessário."
  }
}
```

| Código de Erro | Status HTTP | Significado |
|----------------|:-----------:|-------------|
| `BAD_REQUEST` | 400 | Payload malformado, formato inválido ou campo obrigatório ausente |
| `UNAUTHORIZED` | 401 | API Key ausente, formato inválido ou chave inexistente/revogada |
| `INSUFFICIENT_SCOPE` | 403 | A chave não possui os escopos necessários para a operação |
| `FORBIDDEN` | 403 | Chave expirada ou tenant suspenso |
| `NOT_FOUND` | 404 | Recurso solicitado não encontrado para o tenant autenticado |
| `CONFLICT` | 409 | Violação de integridade ou conflito de horário (double-booking) |
| `INTERNAL_ERROR` | 500 | Erro não previsto nos servidores da SMG Platform |
| `GATEWAY_TIMEOUT` | 504 | Timeout ao despachar para o endpoint do webhook (> 8s) |

---

## 8. Suporte ao Desenvolvedor

- **Central de Dúvidas Técnicas:** `api-support@soumanager.com`
- **SLA de Resposta a Integrações:** < 24 horas (Planos Pro e Enterprise)
- **Status da Plataforma:** `https://status.soumanager.com`
