## Descrição do Problema
Os componentes de impressão `CashClosingPage.tsx` (linha 261) e `Comandas.tsx` (linha 1249) abrem janelas `about:blank` e injetam HTML via `printWindow.document.write()`.

## Por que é explorável
Ambos os fluxos já contam com tratamento preventivo através de `escapeHtml()` e anulação de contexto (`printWindow.opener = null`), neutralizando a vulnerabilidade de XSS. No entanto, o método `document.write` é desaconselhado pelos padrões modernos de desenvolvimento web e apresenta risco de regressão caso outros desenvolvedores introduzam novos dados dinâmicos sem a função de escape.

## Evidência
- `pages/CashClosingPage.tsx:261`
- `pages/Comandas.tsx:1249`

## Impacto
Risco potencial de regressão futura em manutenções no frontend.

## Sugestão de Correção
Adotar uma folha de estilos dedicada para impressão (@media print) ou componentes modais em tela com acionamento nativo de `window.print()`, evitando a criação de contextos `about:blank`.

## Critérios de Aceite
- [ ] Remoção de chamadas a `document.write()` no frontend
- [ ] Impressão de comanda e fechamento de caixa operando via estilos CSS de impressão nativos
