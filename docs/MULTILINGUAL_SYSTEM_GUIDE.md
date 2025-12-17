# Sistema de Multilinguagens - Lush America Translations

## Visão Geral

Este projeto implementa um sistema completo de multilinguagens usando `react-i18next` com suporte para:
- 🇧🇷 **Português (pt)** - Idioma padrão
- 🇪🇸 **Espanhol (es)** 
- 🇺🇸 **Inglês (en)** - Idioma de fallback

## Arquitetura

### Estrutura de Arquivos

```
src/
├── locales/                 # Arquivos de tradução
│   ├── pt.json            # Traduções em português
│   ├── es.json            # Traduções em espanhol
│   └── en.json            # Traduções em inglês (fallback)
├── contexts/
│   └── I18nContext.tsx    # Contexto de internacionalização
├── hooks/
│   └── useTranslation.ts  # Hook personalizado para traduções
├── components/
│   └── LanguageSelector.tsx # Seletor de idioma
└── types/
    └── i18n.ts            # Tipos TypeScript para traduções
```

### Componentes Principais

#### 1. I18nContext.tsx
- Gerencia o estado do idioma atual
- Configura o i18next com detecção automática
- Fornece funções para mudança de idioma
- Persiste a preferência no localStorage

#### 2. LanguageSelector.tsx
- Interface para seleção de idioma
- Exibe bandeiras e nomes dos idiomas
- Dropdown responsivo com overlay
- Integrado no Header da aplicação

#### 3. useTranslation.ts
- Hook personalizado para facilitar o uso
- Funções de conveniência para traduções comuns
- Acesso direto às chaves de tradução organizadas por categoria

## Como Usar

### 1. Uso Básico com useI18n

```tsx
import { useI18n } from '../contexts/I18nContext';

function MyComponent() {
  const { t, currentLanguage, changeLanguage } = useI18n();
  
  return (
    <div>
      <h1>{t('dashboard.welcome')}</h1>
      <p>Idioma atual: {currentLanguage}</p>
      <button onClick={() => changeLanguage('es')}>
        Mudar para Espanhol
      </button>
    </div>
  );
}
```

### 2. Uso com Hook Personalizado

```tsx
import { useTranslation } from '../hooks/useTranslation';

function MyComponent() {
  const { common, auth, dashboard } = useTranslation();
  
  return (
    <div>
      <h1>{dashboard.welcome()}</h1>
      <button>{common.save()}</button>
      <p>{auth.login()}</p>
    </div>
  );
}
```

### 3. Traduções com Interpolação

```tsx
// No arquivo de tradução (pt.json)
{
  "notifications": {
    "unreadCount": "{{count}} não lida",
    "unreadCount_plural": "{{count}} não lidas"
  }
}

// No componente
const { t } = useI18n();
const count = 5;
<p>{t('notifications.unreadCount', { count })}</p>
// Resultado: "5 não lidas"
```

## Adicionando Novas Traduções

### 1. Atualizar Arquivos de Tradução

Adicione as novas chaves em todos os arquivos de idioma:

```json
// pt.json
{
  "newSection": {
    "newKey": "Nova Tradução"
  }
}

// es.json
{
  "newSection": {
    "newKey": "Nueva Traducción"
  }
}

// en.json
{
  "newSection": {
    "newKey": "New Translation"
  }
}
```

### 2. Atualizar Tipos TypeScript

```typescript
// src/types/i18n.ts
export interface TranslationKeys {
  // ... outras seções
  newSection: {
    newKey: string;
  };
}
```

### 3. Atualizar Hook Personalizado

```typescript
// src/hooks/useTranslation.ts
export const useTranslation = () => {
  // ... outras funções
  newSection: {
    newKey: () => t('newSection.newKey')
  }
};
```

## Configuração Avançada

### Detecção Automática de Idioma

O sistema detecta automaticamente o idioma baseado em:
1. **localStorage** - Preferência salva pelo usuário
2. **navigator** - Idioma do navegador
3. **htmlTag** - Atributo lang do HTML

### Fallback de Idioma

Se uma tradução não for encontrada:
1. Tenta no idioma atual
2. Fallback para inglês (en)
3. Exibe a chave da tradução se não encontrar

### Debug Mode

No ambiente de desenvolvimento, o i18next exibe logs detalhados:
- Chaves de tradução não encontradas
- Fallbacks utilizados
- Detecção de idioma

## Boas Práticas

### 1. Organização das Chaves
- Use estrutura hierárquica clara
- Agrupe por funcionalidade (auth, dashboard, documents)
- Mantenha consistência entre idiomas

### 2. Nomenclatura
- Use camelCase para chaves
- Seja descritivo e específico
- Evite chaves muito longas

### 3. Pluralização
- Use sufixos `_plural` para idiomas que precisam
- Teste com diferentes números
- Considere idiomas com regras complexas de plural

### 4. Interpolação
- Use variáveis para conteúdo dinâmico
- Mantenha a estrutura das frases flexível
- Teste com diferentes idiomas

## Exemplos de Uso Comum

### Formulários
```tsx
const { auth, common } = useTranslation();

<form>
  <label>{auth.email()}</label>
  <input placeholder={auth.email()} />
  <button type="submit">{common.submit()}</button>
</form>
```

### Mensagens de Erro
```tsx
const { errors } = useTranslation();

{error && (
  <div className="error">
    {errors.validationError()}
  </div>
)}
```

### Navegação
```tsx
const { navigation } = useTranslation();

<nav>
  <Link to="/">{navigation.home()}</Link>
  <Link to="/dashboard">{navigation.dashboard()}</Link>
</nav>
```

## Troubleshooting

### Problema: Tradução não aparece
- Verifique se a chave existe em todos os arquivos de idioma
- Confirme se o provider está envolvendo o componente
- Verifique o console para erros de i18next

### Problema: Idioma não muda
- Verifique se o `changeLanguage` está sendo chamado
- Confirme se o localStorage está sendo atualizado
- Verifique se o componente está re-renderizando

### Problema: Fallback não funciona
- Confirme se o inglês está configurado como fallback
- Verifique se os arquivos de tradução estão sendo importados
- Confirme se não há erros de sintaxe JSON

## Próximos Passos

### Melhorias Sugeridas
1. **Lazy Loading** - Carregar idiomas sob demanda
2. **Cache de Traduções** - Melhorar performance
3. **Validação de Traduções** - Verificar traduções faltantes
4. **RTL Support** - Suporte para idiomas da direita para esquerda
5. **Formatação de Datas/Números** - Internacionalização de formatos

### Integração com Backend
1. **API de Traduções** - Carregar traduções do servidor
2. **Sincronização** - Manter traduções atualizadas
3. **Cache Distribuído** - Compartilhar traduções entre usuários

## Conclusão

O sistema de multilinguagens implementado fornece uma base sólida e escalável para internacionalização da aplicação. Com a arquitetura modular e hooks personalizados, é fácil adicionar novos idiomas e manter as traduções organizadas.

A implementação segue as melhores práticas do React e i18next, garantindo performance e manutenibilidade a longo prazo.
