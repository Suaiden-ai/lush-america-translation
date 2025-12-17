// Script temporário para apagar arquivos de teste do storage
// Execute com: node delete_test_files.js

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://yslbjhnqfkjdoxuixfyh.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('❌ VITE_SUPABASE_ANON_KEY não encontrado no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Caminhos dos arquivos a serem apagados (extraídos das URLs)
const filesToDelete = [
  'e564298c-168b-4135-a9df-4b859b3b6081/nao_autenticar_teste_S379N5.pdf',
  'e564298c-168b-4135-a9df-4b859b3b6081/nao_autenticar_teste_FIP2VV.pdf', // Tentar também o nome correto
  'f8ed722c-df3d-487d-b5c8-506b2b361501/nao_autenticar_teste_UG1BRZ.pdf',
  'f8ed722c-df3d-487d-b5c8-506b2b361501/nao_autenticar_teste_7MI2DC.pdf',
];

async function deleteFiles() {
  console.log('🗑️ Iniciando exclusão de arquivos de teste...\n');

  for (const filePath of filesToDelete) {
    try {
      console.log(`Tentando apagar: ${filePath}`);
      
      const { data, error } = await supabase.storage
        .from('documents')
        .remove([filePath]);

      if (error) {
        console.error(`  ❌ Erro ao apagar ${filePath}:`, error.message);
      } else {
        console.log(`  ✅ Arquivo apagado: ${filePath}`);
      }
    } catch (err) {
      console.error(`  ❌ Exceção ao apagar ${filePath}:`, err.message);
    }
  }

  console.log('\n✅ Processo concluído!');
}

deleteFiles();
