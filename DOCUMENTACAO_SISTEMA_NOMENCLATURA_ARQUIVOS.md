# 📄 Sistema de Nomenclatura Única de Arquivos (Unique File Naming)

Este documento descreve o funcionamento do sistema de geração de nomes únicos para arquivos na plataforma Lush America, garantindo a integridade dos dados e evitando conflitos no armazenamento.

---

## 🎯 Objetivo
O objetivo principal deste sistema é evitar que arquivos com o mesmo nome (ex: `documento.pdf`) sejam sobrescritos no **Supabase Storage**. Ao adicionar um sufixo aleatório, permitimos que múltiplos usuários enviem arquivos com nomes idênticos sem causar perda de informação ou erros de sistema.

## 📍 Localização do Código
A lógica central está implementada no arquivo:
`src/utils/fileUtils.ts` -> Função: `generateUniqueFileName`

---

## 🛠️ Funcionamento Técnico

A função `generateUniqueFileName` processa o nome do arquivo original em quatro etapas:

### 1. Separação de Nome e Extensão
O sistema identifica a extensão do arquivo (ex: `.pdf`, `.jpg`) para garantir que o código aleatório seja inserido antes dela.
- **Entrada:** `contrato.pdf`
- **Nome:** `contrato`
- **Extensão:** `.pdf`

### 2. Sanitização (Limpeza)
Para garantir que o arquivo possa ser acessado via URL sem problemas, o nome passa por uma limpeza:
- Converte para **minúsculas** (lowercase).
- Substitui espaços e caracteres especiais (acentos, símbolos) por sublinhados (`_`).
- Remove sublinhados duplicados ou no início/fim do nome.

### 3. Sufixo Aleatório (Hash)
É gerado um código de **6 caracteres alfanuméricos** em letras maiúsculas:
```typescript
const randomCode = Math.random().toString(36).substr(2, 6).toUpperCase();
```
Este código garante que, estatisticamente, a chance de dois arquivos iguais terem o mesmo nome final é praticamente zero.

### 4. Montagem Final
O nome é reconstruído seguindo o padrão:
`{nome_sanitizado}_{CÓDIGO}.{extensao}`

---

## 💡 Exemplos de Conversão

| Nome Original | Nome Sanitizado | Código Gerado | Nome Final no Storage |
| :--- | :--- | :--- | :--- |
| `RG 2024.pdf` | `rg_2024` | `A1B2C3` | `rg_2024_A1B2C3.pdf` |
| `Minha Foto (1).jpg` | `minha_foto_1` | `K8L9M2` | `minha_foto_1_K8L9M2.jpg` |
| `Contrato#Final.pdf` | `contrato_final` | `P5Q4R3` | `contrato_final_P5Q4R3.pdf` |

---

## ✅ Benefícios do Sistema

1. **Prevenção de Conflitos:** Dois usuários podem subir um arquivo chamado `identidade.pdf` simultaneamente; o sistema os salvará como `identidade_XXXXXX.pdf` e `identidade_YYYYYY.pdf`.
2. **URLs Seguras:** A sanitização remove caracteres que poderiam quebrar links de download (como `%`, `#`, `&`).
3. **Manutenibilidade:** A lógica é centralizada em um único utilitário, facilitando futuras alterações de padrão.
4. **Experiência do Administrador:** Embora o arquivo físico tenha um nome único, o sistema salva o nome original na coluna `original_filename` do banco de dados para referência humana.

---

## 🔧 Como utilizar no código
Para utilizar esta funcionalidade em novos módulos:

```typescript
import { generateUniqueFileName } from '../../utils/fileUtils';

const file = // seu arquivo do input
const uniqueName = generateUniqueFileName(file.name);
// Use uniqueName para o upload no Storage
```

---
*Documentação gerada para Lush America - Janeiro 2026.*
