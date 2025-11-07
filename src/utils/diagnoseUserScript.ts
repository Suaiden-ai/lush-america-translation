/**
 * Script para diagnosticar problemas de um usuário específico
 * 
 * USO NO CONSOLE DO NAVEGADOR:
 * 
 * 1. Abra o console do navegador (F12)
 * 2. Execute:
 *    await window.diagnoseUser('88c89d41-605e-422d-8112-bce25f8e980f')
 *    await window.diagnoseUserWithSupabase('88c89d41-605e-422d-8112-bce25f8e980f') ← NOVO!
 * 
 * Ou para ver apenas erros:
 *    await window.getUserErrors('88c89d41-605e-422d-8112-bce25f8e980f')
 */

import { diagnoseUser, getUserErrors, getUserDownloadAttempts } from './userDiagnostics';
import { supabase } from '../lib/supabase';

// Expor funções globalmente para uso no console
if (typeof window !== 'undefined') {
  (window as any).diagnoseUser = async (userId: string, hoursBack: number = 24) => {
    try {
      const diagnosis = await diagnoseUser(userId, hoursBack);
      
      console.log('\n🔍 ===== DIAGNÓSTICO DO USUÁRIO =====');
      console.log(`👤 User ID: ${userId}`);
      console.log(`⏰ Período: ${diagnosis.period}`);
      console.log(`\n📊 RESUMO ESTATÍSTICO:`);
      console.log(`   • Total de erros: ${diagnosis.summary.totalErrors}`);
      console.log(`   • Total de tentativas: ${diagnosis.summary.totalAttempts}`);
      console.log(`   • Taxa de erro: ${diagnosis.summary.errorRate}`);
      
      if (Object.keys(diagnosis.summary.errorsByType).length > 0) {
        console.log(`\n❌ ERROS POR TIPO:`);
        Object.entries(diagnosis.summary.errorsByType).forEach(([type, count]) => {
          const emoji = type.includes('auth') ? '🔐' : type.includes('download') ? '📥' : type.includes('upload') ? '📤' : type.includes('network') ? '🌐' : '⚠️';
          console.log(`   ${emoji} ${type}: ${count} ocorrência(s)`);
        });
      } else {
        console.log(`\n✅ Nenhum erro encontrado no período!`);
      }
      
      if (diagnosis.summary.topDocuments.length > 0) {
        console.log(`\n📄 DOCUMENTOS COM MAIS TENTATIVAS:`);
        diagnosis.summary.topDocuments.forEach((doc, index) => {
          console.log(`   ${index + 1}. Document ID: ${doc.documentId}`);
          console.log(`      Tentativas: ${doc.attempts}`);
        });
      }
      
      if (diagnosis.errors.length > 0) {
        console.log(`\n🔍 DETALHES DOS ÚLTIMOS ${diagnosis.errors.length} ERROS:`);
        diagnosis.errors.forEach((error, index) => {
          console.log(`\n   ${index + 1}. [${error.action_type}]`);
          console.log(`      📝 Descrição: ${error.action_description}`);
          console.log(`      🕐 Data: ${new Date(error.created_at).toLocaleString('pt-BR')}`);
          if (error.metadata) {
            const metadata = error.metadata as any;
            if (metadata.error_message) console.log(`      💬 Mensagem: ${metadata.error_message}`);
            if (metadata.file_path) console.log(`      📁 Arquivo: ${metadata.file_path}`);
            if (metadata.filename) console.log(`      📄 Nome: ${metadata.filename}`);
            if (metadata.error_code) console.log(`      🔢 Código: ${metadata.error_code}`);
            if (metadata.error_status) console.log(`      📊 Status: ${metadata.error_status}`);
          }
        });
      }
      
      if (diagnosis.recentAttempts.length > 0) {
        console.log(`\n📋 ÚLTIMAS ${diagnosis.recentAttempts.length} TENTATIVAS:`);
        diagnosis.recentAttempts.slice(0, 10).forEach((attempt, index) => {
          const emoji = attempt.action_type.includes('download') ? '📥' : '👁️';
          console.log(`   ${index + 1}. ${emoji} ${attempt.action_type}`);
          console.log(`      🕐 ${new Date(attempt.created_at).toLocaleString('pt-BR')}`);
          if (attempt.entity_id) console.log(`      📄 Document ID: ${attempt.entity_id}`);
        });
      }
      
      console.log(`\n💡 PADRÕES IDENTIFICADOS:`);
      console.log(`   • Tem erros de autenticação: ${diagnosis.summary.patterns.hasAuthErrors ? '❌ SIM' : '✅ NÃO'}`);
      console.log(`   • Tem erros de download: ${diagnosis.summary.patterns.hasDownloadErrors ? '❌ SIM' : '✅ NÃO'}`);
      console.log(`   • Tem erros de upload: ${diagnosis.summary.patterns.hasUploadErrors ? '❌ SIM' : '✅ NÃO'}`);
      console.log(`   • Tem erros de rede: ${diagnosis.summary.patterns.hasNetworkErrors ? '❌ SIM' : '✅ NÃO'}`);
      
      if (diagnosis.summary.patterns.mostProblematicDocument) {
        console.log(`\n⚠️ DOCUMENTO MAIS PROBLEMÁTICO:`);
        console.log(`   Document ID: ${diagnosis.summary.patterns.mostProblematicDocument.documentId}`);
        console.log(`   Tentativas: ${diagnosis.summary.patterns.mostProblematicDocument.attempts}`);
      }
      
      console.log(`\n✅ Diagnóstico completo! Objeto retornado:`, diagnosis);
      
      return diagnosis;
    } catch (error) {
      console.error('❌ Erro ao fazer diagnóstico:', error);
      throw error;
    }
  };

  (window as any).getUserErrors = async (userId: string, hoursBack: number = 24) => {
    try {
      const { errors } = await getUserErrors(userId, hoursBack);
      
      console.log(`\n❌ ERROS DO USUÁRIO ${userId} (últimas ${hoursBack}h):`);
      console.log(`Total: ${errors.length} erro(s)\n`);
      
      if (errors.length === 0) {
        console.log('✅ Nenhum erro encontrado!');
        return errors;
      }
      
      errors.forEach((error, index) => {
        console.log(`${index + 1}. [${error.action_type}]`);
        console.log(`   ${error.action_description}`);
        console.log(`   ${new Date(error.created_at).toLocaleString('pt-BR')}`);
        if (error.metadata) {
          console.log(`   Metadata:`, error.metadata);
        }
        console.log('');
      });
      
      return errors;
    } catch (error) {
      console.error('❌ Erro ao buscar erros:', error);
      throw error;
    }
  };

  (window as any).getUserDownloadAttempts = async (userId: string, hoursBack: number = 24) => {
    try {
      const { attempts } = await getUserDownloadAttempts(userId, hoursBack);
      
      console.log(`\n📥 TENTATIVAS DE DOWNLOAD/VIEW DO USUÁRIO ${userId} (últimas ${hoursBack}h):`);
      console.log(`Total: ${attempts.length} tentativa(s)\n`);
      
      if (attempts.length === 0) {
        console.log('ℹ️ Nenhuma tentativa encontrada!');
        return attempts;
      }
      
      // Agrupar por documento
      const byDocument: Record<string, any[]> = {};
      attempts.forEach(attempt => {
        const docId = attempt.entity_id || 'unknown';
        if (!byDocument[docId]) byDocument[docId] = [];
        byDocument[docId].push(attempt);
      });
      
      Object.entries(byDocument).forEach(([docId, docAttempts]) => {
        console.log(`📄 Document ID: ${docId} - ${docAttempts.length} tentativa(s)`);
        docAttempts.slice(0, 5).forEach((attempt, index) => {
          console.log(`   ${index + 1}. ${attempt.action_type} - ${new Date(attempt.created_at).toLocaleString('pt-BR')}`);
        });
        if (docAttempts.length > 5) {
          console.log(`   ... e mais ${docAttempts.length - 5} tentativa(s)`);
        }
        console.log('');
      });
      
      return attempts;
    } catch (error) {
      console.error('❌ Erro ao buscar tentativas:', error);
      throw error;
    }
  };

  (window as any).diagnoseUserWithSupabase = async (userId: string) => {
    try {
      console.log(`\n🔍 ===== DIAGNÓSTICO COMPLETO COM SUPABASE =====`);
      console.log(`👤 User ID: ${userId}\n`);
      
      // Buscar informações do usuário
      const { data: userInfo, error: userError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (userInfo) {
        console.log('📋 INFORMAÇÕES DO USUÁRIO:');
        console.log(`   • Nome: ${userInfo.name}`);
        console.log(`   • Email: ${userInfo.email}`);
        console.log(`   • Role: ${userInfo.role}`);
        console.log(`   • Telefone: ${userInfo.phone || 'N/A'}`);
        console.log(`   • Criado em: ${new Date(userInfo.created_at).toLocaleString('pt-BR')}\n`);
      }
      
      // Executar diagnóstico normal
      const diagnosis = await diagnoseUser(userId, 24);
      
      // Buscar informações dos documentos problemáticos
      if (diagnosis.summary.topDocuments.length > 0) {
        console.log('\n📄 DETALHES DOS DOCUMENTOS PROBLEMÁTICOS:\n');
        
        for (const doc of diagnosis.summary.topDocuments.slice(0, 3)) {
          const { data: docInfo, error: docError } = await supabase
            .from('documents')
            .select('id, filename, original_filename, status, file_url, created_at, updated_at')
            .eq('id', doc.documentId)
            .single();
          
          if (docInfo) {
            console.log(`📄 Document ID: ${doc.documentId}`);
            console.log(`   • Nome: ${docInfo.original_filename || docInfo.filename}`);
            console.log(`   • Status: ${docInfo.status}`);
            console.log(`   • Tentativas: ${doc.attempts}`);
            console.log(`   • URL: ${docInfo.file_url ? '✅ Existe' : '❌ Não existe'}`);
            if (docInfo.file_url) {
              console.log(`   • URL completa: ${docInfo.file_url.substring(0, 100)}...`);
            }
            console.log(`   • Criado em: ${new Date(docInfo.created_at).toLocaleString('pt-BR')}`);
            console.log(`   • Atualizado em: ${new Date(docInfo.updated_at).toLocaleString('pt-BR')}\n`);
            
            // Verificar se há arquivo traduzido
            const { data: translatedDoc } = await supabase
              .from('translated_documents')
              .select('id, translated_file_url, is_authenticated')
              .eq('original_document_id', doc.documentId)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();
            
            if (translatedDoc) {
              console.log(`   • Arquivo traduzido: ✅ Existe`);
              console.log(`   • Autenticado: ${translatedDoc.is_authenticated ? '✅ Sim' : '❌ Não'}`);
              if (translatedDoc.translated_file_url) {
                console.log(`   • URL traduzido: ${translatedDoc.translated_file_url.substring(0, 100)}...`);
              }
            } else {
              console.log(`   • Arquivo traduzido: ❌ Não encontrado`);
            }
            console.log('');
          }
        }
      }
      
      // Buscar tentativas recentes com mais detalhes
      if (diagnosis.recentAttempts.length > 0) {
        console.log('\n📋 ANÁLISE DAS TENTATIVAS RECENTES:\n');
        
        const attemptsByViewType: Record<string, number> = {};
        diagnosis.recentAttempts.forEach(attempt => {
          const viewType = (attempt.metadata as any)?.view_type || 'unknown';
          attemptsByViewType[viewType] = (attemptsByViewType[viewType] || 0) + 1;
        });
        
        console.log('   Tipos de visualização:');
        Object.entries(attemptsByViewType).forEach(([type, count]) => {
          console.log(`   • ${type}: ${count} vez(es)`);
        });
        console.log('');
      }
      
      console.log('✅ Diagnóstico completo com Supabase!');
      return diagnosis;
    } catch (error) {
      console.error('❌ Erro no diagnóstico com Supabase:', error);
      throw error;
    }
  };

  console.log('✅ Funções de diagnóstico carregadas!');
  console.log('📝 Use no console:');
  console.log('   await window.diagnoseUser("USER_ID")');
  console.log('   await window.diagnoseUserWithSupabase("USER_ID") ← NOVO!');
  console.log('   await window.getUserErrors("USER_ID")');
  console.log('   await window.getUserDownloadAttempts("USER_ID")');
}

