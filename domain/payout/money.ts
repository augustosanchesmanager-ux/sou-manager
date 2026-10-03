/**
 * [SMG][DOMAIN][PAYOUT] money
 *
 * RESPONSABILIDADE: arredondamento monetário estrito a duas casas, usado
 * antes de persistir valores em colunas NUMERIC(12, 2).
 *
 * POR QUE EXISTE: o banco protege a aritmética com
 * `chk_net_payout_arithmetic` (net_payout = gross - advances + bonuses),
 * validando centavo por centavo. Somar dinheiro em ponto flutuante no
 * cliente produz resíduo (0.1 + 0.2 = 0.30000000000000004) que violaria o
 * CHECK em runtime, apesar de o valor "parecer" correto.
 *
 * DÍVIDA TÉCNICA: a mesma fórmula está inline em
 * `application/cashClosing/summary.ts` (pendingCommission). Consolidar os
 * dois usos exige ADR próprio e NÃO pode ser feito aqui — este módulo
 * isolado é o bounded context de Payout e não deve criar dependência com
 * o fechamento de caixa.
 *
 * GARANTIAS:
 *   - Determinística: mesma entrada, mesmo resultado.
 *   - Sem estado, sem I/O, sem dependência de React.
 */

const CENTS_FACTOR = 100;

/**
 * Arredonda para duas casas decimais no padrão bancário.
 *
 * Só é confiável para valores cuja fonte tenha no máximo duas casas
 * (NUMERIC(12, 2)). O epsilon corrige erro de acumulação de soma, que é o
 * risco real aqui. Ele NÃO corrige o caso de meia casa (1.005 → 1.00), que
 * exigiria fonte com mais precisão e regra de tie-breaking explícita.
 *
 * @param amount Valor monetário. Não-finite retorna 0.
 */
export function roundCents(amount: number): number {
    if (!Number.isFinite(amount)) return 0;
    return Math.round((amount + Number.EPSILON) * CENTS_FACTOR) / CENTS_FACTOR;
}

/**
 * Aplica roundCents a cada parcela e ao total, preservando a invariante de
 * que a soma dos arredondados não diverge do total arredondado.
 *
 * Somar parcelas já arredondadas é o que evita o resíduo: arredondar só o
 * total deixaria a diferença entre as duas rotas como erro de constraint.
 */
export function sumCents(amounts: readonly number[]): number {
    let acc = 0;
    for (const amount of amounts) {
        acc += roundCents(amount);
    }
    return roundCents(acc);
}