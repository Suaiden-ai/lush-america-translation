import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { supabase } from '../../../lib/supabase';
import { MappedPayment } from '../types/payments.types';
import { DateRange } from '../../../components/DateRangeFilter';
import { formatDateTime, safeNumber } from '../utils/paymentsUtils';

interface ExportData {
  documentsMap: Map<string, any>;
  paymentsMap: Map<string, number>;
  authenticationMap: Map<string, any>;
  verifiedDocsDataForLookup: any[];
}

/**
 * Formata data para nome de arquivo
 */
function formatDateForFileName(date: Date | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Gera nome do arquivo baseado no período
 */
export function generateFileName(dateFilter: DateRange | null): string {
  const startDateStr = formatDateForFileName(dateFilter?.startDate || null);
  const endDateStr = formatDateForFileName(dateFilter?.endDate || null);
  const hasDateFilter = startDateStr || endDateStr;

  let fileName = 'payments-report';
  if (hasDateFilter) {
    if (startDateStr && endDateStr) {
      fileName = `payments-report-${startDateStr}_to_${endDateStr}`;
    } else if (startDateStr) {
      fileName = `payments-report-from-${startDateStr}`;
    } else if (endDateStr) {
      fileName = `payments-report-until-${endDateStr}`;
    }
  } else {
    fileName = `payments-report-${new Date().toISOString().split('T')[0]}`;
  }
  return `${fileName}.xlsx`;
}

/**
 * Filtra pagamentos para exportação (exclui refunded, failed e Luiz como usuário)
 */
function filterPaymentsForExport(payments: MappedPayment[]): MappedPayment[] {
  return payments.filter(payment => {
    const paymentStatus = (payment.status || '').toLowerCase();
    
    // Excluir refunded e failed
    if (paymentStatus === 'refunded' || paymentStatus === 'failed') {
      return false;
    }

    // Excluir Luiz como usuário (não autenticador)
    const userEmail = (payment.user_email || '').toLowerCase();
    const userName = (payment.user_name || '').toLowerCase();

    const isLuizUser = 
      userEmail.includes('luizeduardomcsantos') ||
      userEmail.includes('luizeduardogouveia7') ||
      userName.includes('luiz eduardo');

    return !isLuizUser;
  });
}

/**
 * Busca dados necessários para exportação
 */
export async function fetchExportData(payments: MappedPayment[]): Promise<ExportData> {
  // Coletar todos os documentIds
  const allDocumentIds = new Set<string>();
  payments.forEach(payment => {
    if (payment.document_id) {
      allDocumentIds.add(payment.document_id);
    }
  });
  
  // Buscar documents_to_be_verified para obter original_document_id
  const { data: allVerifiedDocs } = await supabase
    .from('documents_to_be_verified')
    .select('id, original_document_id')
    .in('id', Array.from(allDocumentIds));
  
  if (allVerifiedDocs) {
    allVerifiedDocs.forEach(dtbv => {
      if (dtbv.original_document_id) {
        allDocumentIds.add(dtbv.original_document_id);
      }
    });
  }
  
  const documentIds = Array.from(allDocumentIds);
  const documentsMap = new Map();
  const paymentsMap = new Map();
  const authenticationMap = new Map();
  let verifiedDocsDataForLookup: any[] = [];
  
  if (documentIds.length > 0) {
    // Buscar da tabela documents
    const { data: documentsData } = await supabase
      .from('documents')
      .select('id, total_cost, pages, authenticated_by_name, authenticated_by_email, authentication_date, is_authenticated')
      .in('id', documentIds);
    
    if (documentsData) {
      documentsData.forEach(doc => {
        documentsMap.set(doc.id, doc);
        
        if (doc.authenticated_by_name || doc.authenticated_by_email || doc.is_authenticated) {
          authenticationMap.set(doc.id, {
            authenticated_by_name: doc.authenticated_by_name,
            authenticated_by_email: doc.authenticated_by_email,
            authentication_date: doc.authentication_date,
            is_authenticated: doc.is_authenticated,
            status: doc.is_authenticated ? 'completed' : null
          });
        }
      });
    }

    // Buscar de documents_to_be_verified
    const { data: verifiedDocsData } = await supabase
      .from('documents_to_be_verified')
      .select('id, total_cost, pages, original_document_id')
      .in('id', documentIds);
    
    if (verifiedDocsData) {
      verifiedDocsDataForLookup = verifiedDocsData;
      verifiedDocsData.forEach(doc => {
        documentsMap.set(doc.id, doc);
      });
      
      const originalDocIds = verifiedDocsData
        .map(doc => doc.original_document_id)
        .filter(Boolean);
      
      if (originalDocIds.length > 0) {
        const { data: originalDocsData } = await supabase
          .from('documents')
          .select('id, total_cost, pages')
          .in('id', originalDocIds);
        
        if (originalDocsData) {
          originalDocsData.forEach(doc => {
            documentsMap.set(doc.id, doc);
          });
        }
      }
    }

    // Buscar dados de autenticação de translated_documents
    const { data: dtbvFullData } = await supabase
      .from('documents_to_be_verified')
      .select('id, original_document_id')
      .in('original_document_id', documentIds);
    
    if (dtbvFullData && dtbvFullData.length > 0) {
      const dtbvIds = dtbvFullData.map(d => d.id);
      
      const { data: translatedDocsData } = await supabase
        .from('translated_documents')
        .select('original_document_id, authenticated_by_name, authenticated_by_email, authentication_date, is_authenticated, status')
        .in('original_document_id', dtbvIds);
      
      if (translatedDocsData) {
        const dtbvMap = new Map(dtbvFullData.map(d => [d.id, d.original_document_id]));
        
        translatedDocsData.forEach(td => {
          const dtbvId = td.original_document_id;
          const originalDocId = dtbvMap.get(dtbvId);
          
          if (originalDocId) {
            authenticationMap.set(originalDocId, {
              authenticated_by_name: td.authenticated_by_name,
              authenticated_by_email: td.authenticated_by_email,
              authentication_date: td.authentication_date,
              is_authenticated: td.is_authenticated,
              status: td.status
            });
          }
        });
      }
    }

    // Buscar para autenticadores
    if (verifiedDocsData && verifiedDocsData.length > 0) {
      const dtbvIdsFromVerified = verifiedDocsData.map(d => d.id);
      
      if (dtbvIdsFromVerified.length > 0) {
        const { data: translatedDocsForAuth } = await supabase
          .from('translated_documents')
          .select('original_document_id, authenticated_by_name, authenticated_by_email, authentication_date, is_authenticated, status')
          .in('original_document_id', dtbvIdsFromVerified);
        
        if (translatedDocsForAuth) {
          const dtbvMapForAuth = new Map(verifiedDocsData.map(d => [d.id, d.original_document_id]));
          
          translatedDocsForAuth.forEach(td => {
            const dtbvId = td.original_document_id;
            const originalDocId = dtbvMapForAuth.get(dtbvId);
            
            const authData = {
              authenticated_by_name: td.authenticated_by_name,
              authenticated_by_email: td.authenticated_by_email,
              authentication_date: td.authentication_date,
              is_authenticated: td.is_authenticated,
              status: td.status
            };
            
            if (dtbvId) {
              authenticationMap.set(dtbvId, authData);
            }
            if (originalDocId) {
              authenticationMap.set(originalDocId, authData);
            }
          });
        }
      }
    }

    // Buscar payment_amount da tabela payments
    const { data: paymentsData } = await supabase
      .from('payments')
      .select('document_id, amount')
      .in('document_id', documentIds);
    
    if (paymentsData) {
      paymentsData.forEach(payment => {
        paymentsMap.set(payment.document_id, payment.amount);
      });
    }

    // Para autenticadores, buscar pagamentos pelo original_document_id
    if (verifiedDocsData) {
      const originalDocIds = verifiedDocsData
        .map(doc => doc.original_document_id)
        .filter(Boolean);
      
      if (originalDocIds.length > 0) {
        const { data: authPaymentsData } = await supabase
          .from('payments')
          .select('document_id, amount')
          .in('document_id', originalDocIds);
        
        if (authPaymentsData) {
          authPaymentsData.forEach(payment => {
            paymentsMap.set(payment.document_id, payment.amount);
            verifiedDocsData.forEach(dtbvDoc => {
              if (dtbvDoc.original_document_id === payment.document_id) {
                paymentsMap.set(dtbvDoc.id, payment.amount);
              }
            });
          });
        }
      }
    }
  }

  return {
    documentsMap,
    paymentsMap,
    authenticationMap,
    verifiedDocsDataForLookup
  };
}

/**
 * Busca dados de autenticação para um pagamento específico
 */
function getAuthenticationData(
  payment: MappedPayment,
  docData: any,
  authenticationMap: Map<string, any>,
  verifiedDocsDataForLookup: any[]
): any {
  let authData = authenticationMap.get(payment.document_id);
  
  if (!authData && docData?.original_document_id) {
    authData = authenticationMap.get(docData.original_document_id);
  }
  
  if (!authData && verifiedDocsDataForLookup.length > 0) {
    const dtbvDoc = verifiedDocsDataForLookup.find(d => d.id === payment.document_id);
    if (dtbvDoc?.original_document_id) {
      authData = authenticationMap.get(dtbvDoc.original_document_id);
    }
  }
  
  if (!authData && docData && (docData.authenticated_by_name || docData.authenticated_by_email || docData.is_authenticated)) {
    authData = {
      authenticated_by_name: docData.authenticated_by_name,
      authenticated_by_email: docData.authenticated_by_email,
      authentication_date: docData.authentication_date,
      is_authenticated: docData.is_authenticated,
      status: docData.is_authenticated ? 'completed' : null
    };
  }
  
  if (!authData && (payment.authenticated_by_name || payment.authenticated_by_email)) {
    authData = {
      authenticated_by_name: payment.authenticated_by_name,
      authenticated_by_email: payment.authenticated_by_email,
      authentication_date: payment.authentication_date
    };
  }
  
  return authData;
}

/**
 * Calcula valores financeiros para um pagamento
 */
function calculateFinancialValues(
  payment: MappedPayment,
  docData: any,
  paymentsMap: Map<string, number>
): { amount: number; tax: number; netValue: number; pages: number } {
  let totalCost = docData?.total_cost || 0;
  let netValue = paymentsMap.get(payment.document_id) || 0;
  
  if (netValue === 0 && docData?.original_document_id) {
    netValue = paymentsMap.get(docData.original_document_id) || 0;
    if (netValue > 0) {
      const originalDocData = docData;
      if (originalDocData?.total_cost) {
        totalCost = originalDocData.total_cost;
      }
    }
  }
  
  if (netValue === 0) {
    netValue = payment.amount || 0;
  }
  
  if (totalCost === 0) {
    totalCost = netValue || payment.amount || 0;
  }
  
  const amount = totalCost;
  const netValueFinal = netValue;
  const tax = amount - netValueFinal;
  const pages = docData?.pages || 0;
  
  return { amount, tax, netValue: netValueFinal, pages };
}

/**
 * Cria estrutura básica do workbook
 */
function createWorkbook(dateFilter: DateRange | null): { workbook: ExcelJS.Workbook; worksheet: ExcelJS.Worksheet; headerRowNumber: number; dataStartRow: number } {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Payments');
  
  const startDateStr = formatDateForFileName(dateFilter?.startDate || null);
  const endDateStr = formatDateForFileName(dateFilter?.endDate || null);
  const hasDateFilter = startDateStr || endDateStr;
  
  // Adicionar informações do período
  if (hasDateFilter) {
    const periodInfo = startDateStr && endDateStr
      ? `Período: ${startDateStr} até ${endDateStr}`
      : startDateStr
      ? `A partir de: ${startDateStr}`
      : `Até: ${endDateStr}`;
    
    worksheet.insertRow(1, [periodInfo]);
    const infoRow = worksheet.getRow(1);
    infoRow.font = { bold: true, size: 12, color: { argb: 'FF4472C4' } };
    infoRow.height = 20;
    worksheet.mergeCells(1, 1, 1, 13);
    infoRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.insertRow(2, []);
  }
  
  // Definir colunas com larguras maiores para melhor visualização
  worksheet.columns = [
    { header: 'Document Name', key: 'documentName', width: 50 }, // Aumentado de 30 para 50
    { header: 'User Name', key: 'userName', width: 25 }, // Aumentado de 20 para 25
    { header: 'User Email', key: 'userEmail', width: 35 }, // Aumentado de 25 para 35
    { header: 'Translation Status', key: 'translationStatus', width: 20 }, // Aumentado de 18 para 20
    { header: 'Pages', key: 'pages', width: 10 }, // Aumentado de 8 para 10
    { header: 'Amount', key: 'amount', width: 15 }, // Aumentado de 12 para 15
    { header: 'Tax', key: 'tax', width: 15 }, // Aumentado de 12 para 15
    { header: 'Net Value', key: 'netValue', width: 15 }, // Aumentado de 12 para 15
    { header: 'Payment Method', key: 'paymentMethod', width: 18 }, // Aumentado de 15 para 18
    { header: 'Payment Status', key: 'paymentStatus', width: 18 }, // Aumentado de 15 para 18
    { header: 'Authenticator Name', key: 'authenticatorName', width: 25 }, // Aumentado de 20 para 25
    { header: 'Authentication Date', key: 'authenticationDate', width: 22 }, // Aumentado de 20 para 22
    { header: 'Payment Date', key: 'paymentDate', width: 22 }, // Aumentado de 20 para 22
  ];
  
  const headerRowNumber = hasDateFilter ? 3 : 1;
  const headerRow = worksheet.getRow(headerRowNumber);
  
  const headers = [
    'Document Name', 'User Name', 'User Email', 'Translation Status', 'Pages',
    'Amount', 'Tax', 'Net Value',
    'Payment Method', 'Payment Status',
    'Authenticator Name', 'Authentication Date', 'Payment Date'
  ];
  headers.forEach((header, index) => {
    headerRow.getCell(index + 1).value = header;
  });
  
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.height = 25;
  
  const dataStartRow = hasDateFilter ? 4 : 2;
  
  return { workbook, worksheet, headerRowNumber, dataStartRow };
}

/**
 * Adiciona dados ao worksheet
 */
function addDataToWorksheet(
  worksheet: ExcelJS.Worksheet,
  payments: MappedPayment[],
  exportData: ExportData,
  dataStartRow: number
) {
  payments.forEach((payment) => {
    const docData = exportData.documentsMap.get(payment.document_id);
    const financialValues = calculateFinancialValues(payment, docData, exportData.paymentsMap);
    const authData = getAuthenticationData(
      payment,
      docData,
      exportData.authenticationMap,
      exportData.verifiedDocsDataForLookup
    );
    
    worksheet.addRow({
      documentName: String(payment.document_filename || ''),
      userName: String(payment.user_name || ''),
      userEmail: String(payment.user_email || ''),
      translationStatus: String(payment.document_status || 'pending'),
      pages: safeNumber(financialValues.pages, 0),
      amount: safeNumber(financialValues.amount, 0),
      tax: safeNumber(financialValues.tax, 0),
      netValue: safeNumber(financialValues.netValue, 0),
      paymentMethod: String(payment.payment_method || ''),
      paymentStatus: String(payment.status || ''),
      authenticatorName: String(authData?.authenticated_by_name || ''),
      authenticationDate: formatDateTime(authData?.authentication_date),
      paymentDate: formatDateTime(payment.payment_date || payment.created_at)
    });
  });
}

/**
 * Aplica formatação ao worksheet
 */
function formatWorksheet(
  worksheet: ExcelJS.Worksheet,
  headerRowNumber: number,
  dataStartRow: number
) {
  // Formatar colunas numéricas
  const amountColumn = worksheet.getColumn('amount');
  const taxColumn = worksheet.getColumn('tax');
  const netValueColumn = worksheet.getColumn('netValue');
  const pagesColumn = worksheet.getColumn('pages');

  amountColumn.numFmt = '$#,##0.00';
  taxColumn.numFmt = '$#,##0.00';
  netValueColumn.numFmt = '$#,##0.00';
  pagesColumn.numFmt = '0';

  // Aplicar formatação condicional
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber < dataStartRow) return;

    row.height = 18;

    const paymentStatusCell = row.getCell('paymentStatus');
    const paymentStatus = paymentStatusCell.value?.toString().toLowerCase();

    if (paymentStatus === 'completed') {
      paymentStatusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
    } else if (paymentStatus === 'pending' || paymentStatus === 'pending_verification') {
      paymentStatusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB9C' } };
    } else if (paymentStatus === 'failed') {
      paymentStatusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
    } else if (paymentStatus === 'refunded') {
      paymentStatusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    }

    row.eachCell((cell) => {
      const columnKey = cell.column?.key || '';
      
      if (columnKey === 'pages') {
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      } else if (columnKey === 'amount' || columnKey === 'tax' || columnKey === 'netValue') {
        cell.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      }
      
      if (rowNumber >= dataStartRow) {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
        };
      }
    });
  });

  // Congelar linha do cabeçalho
  worksheet.views = [{ state: 'frozen', ySplit: headerRowNumber }];

  // Adicionar filtros automáticos
  worksheet.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: headerRowNumber, column: 13 }
  };

  // Ajustar larguras das colunas automaticamente baseado no conteúdo
  worksheet.columns.forEach((column) => {
    if (column && column.number) {
      let maxLength = 0;
      
      // Verificar largura do cabeçalho
      const headerCell = worksheet.getRow(headerRowNumber).getCell(column.number);
      if (headerCell.value) {
        maxLength = Math.max(maxLength, String(headerCell.value).length);
      }

      // Verificar largura de todas as células da coluna
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber < dataStartRow) return;
        
        try {
          const cell = row.getCell(column.number);
          if (cell && cell.value !== null && cell.value !== undefined) {
            let cellLength = 0;
            
            if (typeof cell.value === 'number') {
              // Para números formatados (ex: $1,234.56), considerar formato
              cellLength = String(cell.value).length + 3;
            } else if (cell.value instanceof Date) {
              // Para datas, considerar formato brasileiro
              cellLength = cell.value.toLocaleString('pt-BR').length;
            } else {
              // Para strings, usar o comprimento direto
              cellLength = String(cell.value).length;
            }
            
            maxLength = Math.max(maxLength, cellLength);
          }
        } catch (error) {
          console.warn(`Erro ao calcular largura da coluna ${column.number}, linha ${rowNumber}:`, error);
        }
      });

      // Aplicar largura com padding extra (1.3x para espaçamento) e limites
      // Larguras mínimas e máximas específicas por tipo de coluna
      let minWidth = 10;
      let maxWidth = 80;

      const columnKey = column.key || '';
      if (columnKey === 'documentName') {
        minWidth = 40;
        maxWidth = 100; // Document Name pode ser muito longo
      } else if (columnKey === 'userEmail' || columnKey === 'authenticatorName') {
        minWidth = 25;
        maxWidth = 60;
      } else if (columnKey === 'userName') {
        minWidth = 20;
        maxWidth = 50;
      } else if (columnKey === 'authenticationDate' || columnKey === 'paymentDate') {
        minWidth = 20;
        maxWidth = 30;
      } else if (columnKey === 'amount' || columnKey === 'tax' || columnKey === 'netValue') {
        minWidth = 12;
        maxWidth = 20;
      } else if (columnKey === 'pages') {
        minWidth = 8;
        maxWidth = 12;
      }

      const calculatedWidth = Math.min(Math.max(maxLength * 1.3, minWidth), maxWidth);
      column.width = calculatedWidth;
    }
  });
}

/**
 * Função principal de exportação
 */
export async function exportPaymentsReport(
  filteredPayments: MappedPayment[],
  dateFilter: DateRange | null
): Promise<void> {
  if (filteredPayments.length === 0) {
    alert('Nenhum pagamento encontrado para exportar.');
    return;
  }

  try {
    // Filtrar pagamentos para exportação
    const paymentsToExport = filterPaymentsForExport(filteredPayments);

    if (paymentsToExport.length === 0) {
      alert('Nenhum pagamento encontrado para exportar.\n\nA exportação exclui:\n• Pagamentos REFUNDED (reembolsados)\n• Pagamentos FAILED (falhados)\n• Pagamentos onde o Luiz é o usuário (não o autenticador)\n\nVerifique os filtros aplicados.');
      return;
    }

    // Buscar dados
    const exportData = await fetchExportData(paymentsToExport);

    // Criar workbook
    const { workbook, worksheet, headerRowNumber, dataStartRow } = createWorkbook(dateFilter);

    // Adicionar dados
    addDataToWorksheet(worksheet, paymentsToExport, exportData, dataStartRow);

    // Aplicar formatação
    formatWorksheet(worksheet, headerRowNumber, dataStartRow);

    // Gerar buffer e fazer download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const fileName = generateFileName(dateFilter);
    saveAs(blob, fileName);

    console.log(`✅ Exportação concluída! ${paymentsToExport.length} pagamento(s) exportado(s). Arquivo: ${fileName}`);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    alert('Erro ao exportar para Excel. Por favor, tente novamente.');
  }
}
