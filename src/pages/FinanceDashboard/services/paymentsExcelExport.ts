import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { MappedPayment } from '../types/payments.types';
import { DateRange } from '../../../components/DateRangeFilter';

const formatDateSafely = (dateValue: string | Date | null | undefined): string => {
  if (!dateValue) return '';
  try {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString('pt-BR', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  } catch { return ''; }
};

/**
 * Exporta os pagamentos para Excel usando os dados JÁ PRESENTES na tela.
 * Isso garante que o que o usuário vê (incluindo autenticadores e páginas) seja o que é exportado.
 */
export async function exportPaymentsReport(
  payments: MappedPayment[],
  dateRange: DateRange | null
): Promise<void> {
  try {
    // 1. FILTRAGEM (IGUAL AO ADMIN)
    const paymentsToExport = payments.filter(p => {
      const pStatus = (p.status || '').toLowerCase();
      // Ignorar rascunhos, não-pagos e reembolsados
      if (p.document_status === 'draft' || pStatus === 'refunded' || pStatus !== 'completed') {
        return false;
      }

      // Filtro Luiz (Usuário)
      const email = (p.user_email || '').toLowerCase();
      const name = (p.user_name || '').toLowerCase();
      const isLuizUser = email.includes('luizeduard') || name.includes('luiz eduardo');

      return !isLuizUser;
    });

    if (paymentsToExport.length === 0) {
      alert('Nenhum dado para exportar com os filtros atuais.');
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');

    // 2. CABEÇALHO DE PERÍODO (AZUL)
    const hasDate = dateRange?.startDate || dateRange?.endDate;
    const hRow = hasDate ? 3 : 1;

    if (hasDate) {
      const start = dateRange?.startDate ? new Date(dateRange.startDate).toLocaleDateString('pt-BR') : '';
      const end = dateRange?.endDate ? new Date(dateRange.endDate).toLocaleDateString('pt-BR') : '';
      worksheet.getRow(1).values = [`Período: ${start} até ${end}`];
      worksheet.mergeCells(1, 1, 1, 13);
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FF4472C4' }, size: 12 };
    }

    // 3. NOMES DAS COLUNAS (TEXTO BRANCO / FUNDO AZUL)
    const headers = [
      'Document Name', 'User Name', 'User Email', 'Translation Status', 'Pages',
      'Amount', 'Tax', 'Net Value', 'Payment Method', 'Payment Status',
      'Authenticator Name', 'Authentication Date', 'Payment Date'
    ];

    const head = worksheet.getRow(hRow);
    head.values = headers;
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    head.alignment = { horizontal: 'center', vertical: 'middle' };
    head.height = 25;

    // 4. ADICIONAR DADOS (USANDO MAPA JÁ EXISTENTE NO FRONTEND)
    paymentsToExport.forEach(p => {
      // Lógica de cálculo de valores (Bruto, Taxa, Líquido)
      // IGUAL AO ADMIN DASHBOARD: Tax = Total Cost - Amount
      const amount = p.gross_amount || p.total_cost || 0;
      const netValue = p.amount || 0;
      const tax = Math.max(0, amount - netValue);

      worksheet.addRow([
        p.document_filename || '',
        p.user_name || '',
        p.user_email || '',
        p.document_status || 'pending',
        p.pages || 0,
        amount,
        tax,
        netValue,
        p.payment_method || '',
        p.status || '',
        p.authenticated_by_name || '',
        formatDateSafely(p.authentication_date),
        formatDateSafely(p.payment_date || p.created_at)
      ]);
    });

    // 5. FORMATAÇÃO E ESTILO
    worksheet.eachRow((row, num) => {
      if (num <= hRow) return;

      // Colunas numéricas (F, G, H)
      [6, 7, 8].forEach(c => {
        row.getCell(c).numFmt = '"$"#,##0.00';
        row.getCell(c).alignment = { horizontal: 'right' };
      });

      // Status verde
      const statusCell = row.getCell(10);
      if (statusCell.value?.toString().toLowerCase() === 'completed') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
      }

      // Bordas
      row.eachCell(c => {
        c.border = {
          top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
        };
      });
    });

    // Ajustar larguras
    worksheet.columns = headers.map((h, i) => ({
      header: h,
      width: i === 0 ? 45 : i === 2 ? 35 : 20
    }));

    worksheet.autoFilter = { from: { row: hRow, column: 1 }, to: { row: hRow, column: 13 } };

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Lush-Finance-Identical-${new Date().toISOString().split('T')[0]}.xlsx`);

  } catch (error) {
    console.error('Export Error:', error);
    alert('Erro ao gerar a planilha.');
  }
}
