# Layout Reference — Admin Documents Table

Baseado no print compartilhado. Use este doc para consultar o código do projeto de origem.

---

## 1. Header

**O que vejo no print:**
- Título "All Documents" — parece `font-size: ~20px`, `font-weight: 600`
- Subtítulo "Showing 602 of 602 documents" — cor cinza, `font-size: ~13px`
- "Total Value: $3280.00" — cor verde, inline com o subtítulo, `font-weight: 600`
- Botões de export no canto direito, alinhados verticalmente ao centro do header

**Perguntas para o outro projeto:**
- Qual é o `padding` do header container? (`py-?`, `px-?`)
- O título e subtítulo usam `gap` ou `margin-top`?
- A cor verde do Total Value é `text-green-600` ou outra?

---

## 2. Barra de Filtros

**O que vejo no print:**
- Search input com ícone de lupa embutido (não separado)
- 4 dropdowns em linha: `All Translation Status` | `All Payment Status` | `All User Roles` | `All time`
- Cada dropdown tem ícone de funil (filter icon) à esquerda, dentro do próprio select ou ao lado
- Tudo em uma única linha horizontal
- Background da barra parece `bg-gray-50` ou `bg-white`

**Perguntas para o outro projeto:**
- O search tem `pl-8` com ícone absoluto dentro, ou é um componente separado?
- Os dropdowns usam `<select>` nativo ou um componente custom?
- Qual o `gap` entre os filtros? (`gap-2`, `gap-3`, `gap-4`?)
- O ícone de funil está dentro do `<select>` ou é um elemento separado ao lado?
- Qual `padding` vertical dos filtros? (`py-2`, `py-1.5`?)

---

## 3. Cabeçalho da Tabela (thead)

**O que vejo no print:**
- Colunas: `USER/CLIENT` | `DOCUMENT` | `AMOUNT` | `PAYMENT METHOD` | `PAYMENT STATUS` | `TRANSLATIONS` | `AUTHENTICATOR` | `DATE` | `DETAILS`
- Texto uppercase, cinza, pequeno — parece `text-xs`, `text-gray-500`, `uppercase`, `tracking-wider`
- Background: `bg-gray-50` ou similar

**Perguntas para o outro projeto:**
- Qual o `padding` das células do `<th>`? (`px-?`, `py-?`)
- Tem `font-weight: medium` ou `semibold` no thead?
- Tem border-bottom no thead? Qual cor?

---

## 4. Linhas da Tabela (tbody rows)

**O que vejo no print — e é o PONTO PRINCIPAL:**
- As linhas são **muito compactas** — pouco espaço vertical entre uma linha e outra
- Texto parece `text-xs` ou `text-sm`
- `padding vertical` da célula parece `py-2` ou até `py-1.5` (bem menor que o padrão `py-4`)
- Cada linha tem hover sutil (provavelmente `hover:bg-gray-50`)
- Separador entre linhas: linha cinza fina (`divide-y divide-gray-100` ou `divide-gray-200`)

**Perguntas para o outro projeto:**
- Qual o `padding` das células `<td>`? (`px-? py-?`)
- A densidade compacta vem de uma classe utilitária como `table-fixed`, `text-xs` no `<table>`, ou cada `<td>` tem padding reduzido individualmente?
- Existe algum `leading` (line-height) customizado nas células?

---

## 5. Células — Conteúdo Específico

### USER/CLIENT
- Nome em cima: texto escuro, `font-medium`
- Email embaixo: texto cinza, menor
- Parece `truncate` ativo (texto cortado com `...`)

### DOCUMENT
- Ícone de arquivo + nome do arquivo (truncado) + "X páginas" embaixo
- Ícone: `w-4 h-4`, cor `text-gray-400`

### AMOUNT
- Valor simples: `$30.00` — `font-semibold`, texto escuro
- Sem badge, só o número

### PAYMENT METHOD
- Badge/pill: `bg-blue-100 text-blue-800`, bordas arredondadas
- Ícone emoji + texto (ex: `💳 Card`, `🔥 Zelle`)

### PAYMENT STATUS
- Badge/pill: verde para "Paid", amarelo para outros
- `bg-green-100 text-green-800` para Paid

### TRANSLATIONS
- Badge/pill: `bg-green-100 text-green-800` para "completed", `bg-blue-100 text-blue-800` para "processing"
- Texto em minúsculo dentro do badge

### AUTHENTICATOR
- Nome em cima: `font-medium`, texto escuro
- Email embaixo: `text-gray-500`
- "N/A" + "No authenticator" quando vazio

### DATE
- Formato: `DD/MM/YYYY` — parece `text-gray-500`, `text-xs`

### DETAILS
- Só o ícone de olho (`Eye`) — `text-blue-600`

**Perguntas para o outro projeto:**
- Os badges usam `rounded-full` ou `rounded-md`?
- Qual o `px` e `py` dos badges? (`px-2 py-0.5`, `px-2.5 py-1`?)
- O `font-size` dos badges é `text-xs` mesmo?

---

## 6. Resumo das Perguntas Prioritárias

| # | Pergunta | Onde buscar |
|---|----------|-------------|
| 1 | `padding` das células `<td>` | componente da tabela, classe do `<td>` |
| 2 | `padding` das células `<th>` | thead do componente |
| 3 | `gap` entre filtros | div wrapper dos filtros |
| 4 | padding do header (título + subtítulo) | div wrapper do header |
| 5 | Classes dos badges (payment, status) | células de badge |
| 6 | `font-size` geral da tabela | `<table>` ou `<tbody>` |
| 7 | Cor exata do separador entre linhas | `divide-*` ou `border-*` no `<table>` |
