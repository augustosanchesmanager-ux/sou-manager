import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Modal from '../ui/Modal';
import { useAuth } from '../../context/AuthContext';
import { useTenantOptional } from '../../src/context/TenantContext';
import { usePayoutService } from '../../src/hooks/usePayoutService';
import type {
    BarberPayoutSettlement,
    PayoutReceiptItem,
    SettlementComputation,
    SettlementStatus,
} from '../../domain/payout/types';

export interface PayoutReceiptStaff {
    id: string;
    name: string;
    role: string;
    avatar?: string;
    commissionRate: number;
}

export interface PayoutReceiptModalProps {
    isOpen: boolean;
    onClose: () => void;
    staff: PayoutReceiptStaff | null;
    periodStart: string;
    periodEnd: string;
    settlement: BarberPayoutSettlement | null;
    preview: SettlementComputation | null;
    status: SettlementStatus | 'unsettled';
}

const brl = (value: number): string =>
    `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (isoString?: string | null): string => {
    if (!isoString) return '--/--/----';
    const datePart = isoString.split('T')[0];
    const [y, m, d] = datePart.split('-');
    if (!y || !m || !d) return isoString;
    return `${d}/${m}/${y}`;
};

export const PayoutReceiptModal: React.FC<PayoutReceiptModalProps> = ({
    isOpen,
    onClose,
    staff,
    periodStart,
    periodEnd,
    settlement,
    preview,
    status,
}) => {
    const { user, tenantId } = useAuth();
    const tenantContext = useTenantOptional();
    const payoutService = usePayoutService();

    const [items, setItems] = useState<PayoutReceiptItem[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);

    // Identificação do Estabelecimento
    const shopName =
        tenantContext?.tenant?.name ||
        user?.user_metadata?.shop_name ||
        user?.user_metadata?.company_name ||
        'SMG Barber';

    const shopDocument =
        user?.user_metadata?.document ||
        user?.user_metadata?.cnpj ||
        user?.user_metadata?.cpf ||
        '';

    const shopAddress =
        user?.user_metadata?.address ||
        user?.user_metadata?.full_address ||
        '';

    const shopPhone =
        user?.user_metadata?.phone ||
        user?.user_metadata?.whatsapp ||
        '';

    // Valores consolidados (do acerto persistido ou da pré-visualização)
    const grossCommission = settlement?.grossCommission ?? preview?.grossCommission ?? 0;
    const advancesDeducted = settlement?.advancesDeducted ?? preview?.advancesDeducted ?? 0;
    const bonusesAdded = settlement?.bonusesAdded ?? preview?.bonusesAdded ?? 0;
    const netPayout = settlement?.netPayout ?? preview?.netPayout ?? 0;

    const paymentMethodDisplay = settlement?.paymentMethod
        ? settlement.paymentMethod.toUpperCase()
        : 'PIX / A COMBINAR';

    const paidAtDisplay = settlement?.paidAt
        ? formatDate(settlement.paidAt)
        : formatDate(new Date().toISOString());

    const receiptNumber = useMemo(() => {
        if (settlement?.id) {
            return `REC-${settlement.id.slice(0, 8).toUpperCase()}`;
        }
        if (staff?.id) {
            return `PRV-${staff.id.slice(0, 4).toUpperCase()}-${periodStart.replace(/-/g, '').slice(4)}`;
        }
        return 'REC-000000';
    }, [settlement, staff, periodStart]);

    // Carregar itens discriminados de atendimentos
    const fetchItems = useCallback(async () => {
        if (!isOpen || !tenantId || !staff || !payoutService) {
            setItems([]);
            return;
        }

        setLoadingItems(true);
        try {
            const list = await payoutService.getSettledPaymentItems({
                tenantId,
                staffId: staff.id,
                periodStart,
                periodEnd,
                commissionRate: staff.commissionRate,
            });
            setItems(list);
        } catch (err) {
            console.error('Erro ao carregar itens do recibo:', err);
            setItems([]);
        } finally {
            setLoadingItems(false);
        }
    }, [isOpen, tenantId, staff, payoutService, periodStart, periodEnd]);

    useEffect(() => {
        if (isOpen) {
            fetchItems();
        }
    }, [isOpen, fetchItems]);

    // Soma total bruta dos serviços listados
    const totalServicesGross = useMemo(() => {
        if (items.length > 0) {
            return items.reduce((sum, item) => sum + item.grossAmount, 0);
        }
        // Fallback aproximado se não houver itens discriminados
        if (staff && staff.commissionRate > 0) {
            return grossCommission / staff.commissionRate;
        }
        return grossCommission;
    }, [items, staff, grossCommission]);

    const handlePrint = () => {
        window.print();
    };

    const handleWhatsAppShare = () => {
        if (!staff) return;

        const ratePercent = (staff.commissionRate * 100).toFixed(0);
        const text = [
            `📄 *COMPROVANTE DE REPASSE DE COMISSÕES*`,
            `🏛️ *Estabelecimento:* ${shopName}`,
            `👤 *Profissional:* ${staff.name} (${staff.role})`,
            `📅 *Período de Apuração:* ${formatDate(periodStart)} até ${formatDate(periodEnd)}`,
            `💳 *Forma de Quitação:* ${paymentMethodDisplay}`,
            `----------------------------------------`,
            `💈 *Base Bruta de Serviços:* ${brl(totalServicesGross)}`,
            `📊 *Taxa Contratual:* ${ratePercent}%`,
            `💵 *Comissão Bruta:* ${brl(grossCommission)}`,
            advancesDeducted > 0 ? `🔻 *Vales/Adiantamentos:* - ${brl(advancesDeducted)}` : null,
            bonusesAdded > 0 ? `⭐ *Bônus/Acréscimos:* + ${brl(bonusesAdded)}` : null,
            `----------------------------------------`,
            `💰 *VALOR LÍQUIDO QUITADO:* ${brl(netPayout)}`,
            `----------------------------------------`,
            `_Documento de quitação emitido via SMG Barber (soumanager.com) nos termos da Lei Federal nº 13.352/2016 (Salão-Parceiro)._`,
        ]
            .filter(Boolean)
            .join('\n');

        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    if (!isOpen || !staff) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Recibo Oficial de Repasse"
            maxWidth="3xl"
        >
            {/* Scoped print CSS: isola o voucher para impressão A4/térmica limpa sem modal backdrop */}
            <style>
                {`
                @media print {
                    body * {
                        visibility: hidden !important;
                    }
                    #payout-receipt-voucher, #payout-receipt-voucher * {
                        visibility: visible !important;
                    }
                    #payout-receipt-voucher {
                        position: fixed !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 24px !important;
                        background: #ffffff !important;
                        color: #0f172a !important;
                        box-shadow: none !important;
                        border: none !important;
                        z-index: 9999999 !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
                `}
            </style>

            <div className="space-y-6">
                {/* Visual Voucher Container */}
                <div
                    id="payout-receipt-voucher"
                    className="bg-white text-slate-800 p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden font-sans print:p-0 print:border-none print:shadow-none"
                >
                    {/* Header decorativo dourado */}
                    <div className="absolute top-0 left-0 w-full h-2.5 bg-gradient-to-r from-amber-600 via-primary to-amber-500 print:bg-black"></div>

                    {/* Cabeçalho do Estabelecimento */}
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-slate-200 mt-1">
                        <div className="flex items-center gap-3.5">
                            <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xl tracking-tighter shrink-0 border border-slate-700 shadow-sm print:border-black print:text-black print:bg-transparent">
                                SMG
                            </div>
                            <div>
                                <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">
                                    {shopName}
                                </h2>
                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    Recibo & Demonstrativo de Comissões
                                </p>
                                {(shopDocument || shopAddress || shopPhone) && (
                                    <p className="text-[11px] text-slate-500 mt-1 space-x-2">
                                        {shopDocument && <span>CNPJ/CPF: {shopDocument}</span>}
                                        {shopAddress && <span>• {shopAddress}</span>}
                                        {shopPhone && <span>• Tel: {shopPhone}</span>}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="text-left sm:text-right shrink-0">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                                Comprovante Nº
                            </span>
                            <span className="text-sm font-black text-slate-900 tracking-wide font-mono">
                                {receiptNumber}
                            </span>
                            <div className="mt-1">
                                <span
                                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                        status === 'paid'
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                            : status === 'approved'
                                            ? 'bg-blue-50 text-blue-700 border-blue-300'
                                            : 'bg-amber-50 text-amber-700 border-amber-300'
                                    }`}
                                >
                                    ● {status === 'paid' ? 'QUITADO' : status === 'approved' ? 'APROVADO' : 'PRÉVIA'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Dados do Profissional e Período */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 py-4 border-b border-slate-100 text-xs">
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">
                                Profissional Parceiro
                            </span>
                            <strong className="text-sm text-slate-900 block truncate">
                                {staff.name}
                            </strong>
                            <span className="text-[11px] text-slate-500">{staff.role}</span>
                        </div>

                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">
                                Período de Apuração
                            </span>
                            <strong className="text-slate-900 block">
                                {formatDate(periodStart)} a {formatDate(periodEnd)}
                            </strong>
                            <span className="text-[10px] text-slate-500">Regime de Caixa</span>
                        </div>

                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">
                                Data do Repasse
                            </span>
                            <strong className="text-slate-900 block">{paidAtDisplay}</strong>
                            <span className="text-[10px] text-slate-500">
                                Via {paymentMethodDisplay}
                            </span>
                        </div>

                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">
                                Alíquota Contratual
                            </span>
                            <strong className="text-slate-900 block text-sm">
                                {(staff.commissionRate * 100).toFixed(0)}%
                            </strong>
                            <span className="text-[10px] text-slate-500">Comissão Efetiva</span>
                        </div>
                    </div>

                    {/* Tabela de Serviços Discriminados */}
                    <div className="py-4">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                                Discriminação dos Atendimentos Realizados
                            </h4>
                            <span className="text-[11px] text-slate-500 font-medium">
                                {items.length} {items.length === 1 ? 'item' : 'itens'}
                            </span>
                        </div>

                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                                    <tr>
                                        <th className="px-3 py-2.5">Data</th>
                                        <th className="px-3 py-2.5">Serviço / Comanda</th>
                                        <th className="px-3 py-2.5 text-center">Qtd</th>
                                        <th className="px-3 py-2.5 text-right">Valor Bruto</th>
                                        <th className="px-3 py-2.5 text-right">Comissão ({ (staff.commissionRate * 100).toFixed(0) }%)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-800">
                                    {loadingItems ? (
                                        <tr>
                                            <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                                                Carregando atendimentos...
                                            </td>
                                        </tr>
                                    ) : items.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                                                Nenhum atendimento individual registrado no período selecionado.
                                            </td>
                                        </tr>
                                    ) : (
                                        items.map((item) => (
                                            <tr key={item.id} className="hover:bg-slate-50/60">
                                                <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                                                    {formatDate(item.date)}
                                                </td>
                                                <td className="px-3 py-2 font-medium">
                                                    <span className="text-slate-900 block">{item.description}</span>
                                                    <span className="text-[10px] text-slate-400 font-mono">
                                                        #{item.comandaId.slice(0, 8)}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-center whitespace-nowrap">
                                                    {item.quantity}
                                                </td>
                                                <td className="px-3 py-2 text-right font-medium text-slate-700 whitespace-nowrap">
                                                    {brl(item.grossAmount)}
                                                </td>
                                                <td className="px-3 py-2 text-right font-bold text-emerald-600 whitespace-nowrap">
                                                    {brl(item.commissionAmount)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Resumo Financeiro / Balancete */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 my-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">
                                    Total de Serviços
                                </span>
                                <span className="text-sm font-bold text-slate-800">
                                    {brl(totalServicesGross)}
                                </span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">
                                    Comissão Bruta
                                </span>
                                <span className="text-sm font-bold text-emerald-600">
                                    {brl(grossCommission)}
                                </span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">
                                    Vales Deduzidos
                                </span>
                                <span className={`text-sm font-bold ${advancesDeducted > 0 ? 'text-red-500' : 'text-slate-500'}`}>
                                    {advancesDeducted > 0 ? `- ${brl(advancesDeducted)}` : brl(0)}
                                </span>
                            </div>
                            <div className="border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-4">
                                <span className="text-[10px] font-black text-slate-900 uppercase block tracking-wider">
                                    Líquido Quitado
                                </span>
                                <span className="text-xl font-black text-slate-900 block">
                                    {brl(netPayout)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Cláusula Legal de Quitação (Lei do Salão-Parceiro) */}
                    <div className="mt-5 pt-4 border-t border-slate-200 text-[10px] leading-relaxed text-slate-600 bg-slate-50/50 p-3 rounded-lg border">
                        <p className="font-bold text-slate-700 uppercase mb-1">
                            Termo de Quitação — Lei Federal nº 13.352/2016 (Salão-Parceiro):
                        </p>
                        <p>
                            Declaro para os devidos fins ter conferido e recebido da empresa acima qualificada a importância
                            líquida de <strong>{brl(netPayout)}</strong>, referente ao repasse de comissões por serviços prestados no
                            período de <strong>{formatDate(periodStart)}</strong> a <strong>{formatDate(periodEnd)}</strong>,
                            em estrito cumprimento às disposições do contrato de parceria, outorgando plena, geral e irrevogável
                            quitação de todas as obrigações pertinentes aos atendimentos aqui discriminados, nada mais tendo a reclamar
                            a qualquer título.
                        </p>
                    </div>

                    {/* Linhas de Assinatura */}
                    <div className="mt-12 pt-6 grid grid-cols-1 sm:grid-cols-2 gap-8 text-center text-xs">
                        <div className="flex flex-col items-center">
                            <div className="w-4/5 border-t border-slate-400 mb-1.5"></div>
                            <span className="font-bold text-slate-900 uppercase text-[11px] block">
                                {staff.name}
                            </span>
                            <span className="text-[10px] text-slate-500 uppercase">
                                Profissional Parceiro(a)
                            </span>
                        </div>

                        <div className="flex flex-col items-center">
                            <div className="w-4/5 border-t border-slate-400 mb-1.5"></div>
                            <span className="font-bold text-slate-900 uppercase text-[11px] block">
                                {shopName}
                            </span>
                            <span className="text-[10px] text-slate-500 uppercase">
                                Responsável / Gestão
                            </span>
                        </div>
                    </div>

                    {/* Rodapé institucional */}
                    <div className="mt-8 pt-3 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center text-[9px] text-slate-400">
                        <span>SMG Barber • Sistema de Gestão Inteligente</span>
                        <span>Documento emitido eletronicamente em {new Date().toLocaleString('pt-BR')}</span>
                    </div>
                </div>

                {/* Botões de Ação na Tela (Ocultados na Impressão via .no-print) */}
                <div className="flex flex-wrap gap-3 justify-end pt-2 border-t border-slate-200 dark:border-border-dark no-print">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                    >
                        Fechar
                    </button>

                    <button
                        onClick={handleWhatsAppShare}
                        className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5 font-display"
                    >
                        <span className="material-symbols-outlined text-[18px]">chat</span>
                        Enviar WhatsApp
                    </button>

                    <button
                        onClick={handlePrint}
                        className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-900 dark:text-night bg-primary hover:bg-primary/90 shadow-md shadow-primary/20 transition-all flex items-center gap-1.5 font-display"
                    >
                        <span className="material-symbols-outlined text-[18px]">print</span>
                        Imprimir Recibo (A4 / Térmica)
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default PayoutReceiptModal;
