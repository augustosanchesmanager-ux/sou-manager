/**
 * src/utils/export/pdfExporter.ts
 *
 * Exportador cliente de relatórios e extratos em formato PDF executivo.
 * Carrega jsPDF e jspdf-autotable sob demanda (lazy-loading / dynamic import)
 * para não sobrecarregar o bundle principal da aplicação.
 *
 * Estilizado no Design System Atelier Tech:
 * - Faixa superior em #0E0C0A
 * - Detalhes e linhas em Latão Envelhecido #B88A44
 * - Summary cards integrados
 * - Tabela autoTable paginada com rodapé institucional
 */

import type { ExportPayload } from './types';

/**
 * Gera e realiza o download do documento PDF com design executivo Atelier Tech.
 */
export async function exportToPdf<T>(
  payload: ExportPayload<T>,
  filename: string
): Promise<void> {
  // 1. Carregamento sob demanda (lazy loading) para isolamento de bundle
  const [jsPDFModule, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const jsPDF = jsPDFModule.default || (jsPDFModule as any).jsPDF || jsPDFModule;
  const autoTableFn =
    autoTableModule.default || (autoTableModule as any).applyPlugin || autoTableModule;

  const orientation = payload.orientation ?? 'portrait';
  const doc = new (jsPDF as any)({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 2. Faixa Executiva Superior (Header Atelier Tech)
  // Fundo #0E0C0A (RGB: 14, 12, 10)
  doc.setFillColor(14, 12, 10);
  doc.rect(0, 0, pageWidth, 26, 'F');

  // Linha de Destaque em Latão Envelhecido #B88A44 (RGB: 184, 138, 68)
  doc.setFillColor(184, 138, 68);
  doc.rect(0, 25.2, pageWidth, 0.8, 'F');

  // Título do Relatório (#F5F5F0)
  doc.setTextColor(245, 245, 240);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(payload.metadata.title, 14, 11);

  // Subtítulo: Unidade e Período (#B88A44)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(184, 138, 68);
  const subtitle = `${payload.metadata.tenantName}  •  Período: ${payload.metadata.periodLabel}`;
  doc.text(subtitle, 14, 18);

  // Data de Emissão à direita (#A8A29E)
  doc.setFontSize(8);
  doc.setTextColor(168, 162, 158);
  doc.text(`Gerado em: ${payload.metadata.generatedAt}`, pageWidth - 14, 11, {
    align: 'right',
  });

  let currentY = 32;

  // 3. Summary Cards (se informados nos metadados)
  const summaryCards = payload.metadata.summaryCards;
  if (summaryCards && summaryCards.length > 0) {
    const cardCount = summaryCards.length;
    const margin = 14;
    const availableWidth = pageWidth - margin * 2;
    const gap = 4;
    const cardWidth = (availableWidth - gap * (cardCount - 1)) / cardCount;
    const cardHeight = 16;

    summaryCards.forEach((card, index) => {
      const cardX = margin + index * (cardWidth + gap);

      // Caixa com fundo claro elegante e borda suave
      doc.setFillColor(250, 250, 249);
      doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 1.5, 1.5, 'F');

      doc.setDrawColor(214, 211, 206);
      doc.setLineWidth(0.2);
      doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 1.5, 1.5, 'S');

      // Friso superior em Latão
      doc.setFillColor(184, 138, 68);
      doc.rect(cardX, currentY, cardWidth, 1.0, 'F');

      // Label do Card
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(card.label.toUpperCase(), cardX + 3.5, currentY + 5.5);

      // Valor do Card
      doc.setFontSize(10.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(24, 24, 24);
      doc.text(card.value, cardX + 3.5, currentY + 12);
    });

    currentY += cardHeight + 6;
  }

  // 4. Montar Colunas e Dados para o autoTable
  const headers = payload.columns.map((col) => col.header);
  const rows = payload.data.map((row) =>
    payload.columns.map((col) => {
      let rawVal: any;
      if (typeof col.key === 'string' && col.key.includes('.')) {
        rawVal = col.key.split('.').reduce((obj: any, key) => obj?.[key], row);
      } else {
        rawVal = (row as any)[col.key];
      }

      const formatted = col.format ? col.format(rawVal, row) : rawVal;
      return formatted !== null && formatted !== undefined ? String(formatted) : '';
    })
  );

  // Executar autoTable
  const tableRunner = typeof (doc as any).autoTable === 'function'
    ? (doc as any).autoTable.bind(doc)
    : typeof autoTableFn === 'function'
    ? (opts: any) => autoTableFn(doc, opts)
    : null;

  if (tableRunner) {
    tableRunner({
      startY: currentY,
      head: [headers],
      body: rows,
      theme: 'striped',
      styles: {
        fontSize: 8,
        cellPadding: 2.2,
        overflow: 'linebreak',
        textColor: [35, 35, 35],
      },
      headStyles: {
        fillColor: [20, 18, 16], // #141210
        textColor: [184, 138, 68], // #B88A44
        fontStyle: 'bold',
        lineWidth: 0.2,
        lineColor: [45, 42, 38], // #2D2A26
      },
      alternateRowStyles: {
        fillColor: [248, 248, 246],
      },
      margin: { left: 14, right: 14, bottom: 16 },
      didDrawPage: (data: any) => {
        const pageNumber = data.pageNumber;

        // Linha divisória do rodapé
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.2);
        doc.line(14, pageHeight - 10, pageWidth - 14, pageHeight - 10);

        // Rodapé com branding e paginação
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(130, 130, 130);
        doc.text('SMG Barber — Sistema de Gestão', 14, pageHeight - 6);
        doc.text(`Página ${pageNumber}`, pageWidth - 14, pageHeight - 6, {
          align: 'right',
        });
      },
    });
  }

  // 5. Salvar Documento
  const safeFilename = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
  doc.save(safeFilename);
}
