# 📔 Explicação Técnica: Proxy de Documentos para N8N

Este documento explica o funcionamento da **Opção 1**, que permitiu ao N8N acessar os arquivos dentro dos buckets privados do Supabase.

---

## 1. O Problema Original (O Bloqueio)
Quando você torna um bucket do Supabase **privado**, o acesso direto via URL pública (ex: `https://.../storage/v1/object/public/...`) é desativado. 
- **Erro 403/404**: O Supabase recusa a entrega do arquivo a menos que haja um token JWT de um usuário logado ou o bucket seja público.
- **Limitação do N8N**: O N8N é um robô externo. Ele não consegue fazer "login" como um usuário comum para obter esse token JWT toda vez que precisa de um arquivo.

---

## 2. A Solução: Arquitetura de Proxy Autenticado
Para resolver isso, criamos uma "ponte" segura chamada **Edge Function `n8n-storage-access`**.

### Como a URL funciona:
A nova URL que você usou tem este formato:
`https://[PROJETO].supabase.co/functions/v1/n8n-storage-access?bucket=[BUCKET]&path=[CAMINHO]&token=[SENHA_MESTRA]`

### O que acontece nos bastidores (Passo a Passo):

#### Passo 1: O Pedido do N8N
O N8N faz uma requisição para a nossa **Edge Function** (em vez de pedir direto ao Storage). Ele envia junto um `token` (a senha gerada).

#### Passo 2: Validação de Identidade (Custom Auth)
Dentro da Edge Function, o código faz o seguinte:
- Ele busca uma variável interna segura chamada `N8N_STORAGE_SECRET` (que configuramos no painel do Supabase).
- Ele compara: "O `token` que o N8N enviou na URL é igual à `N8N_STORAGE_SECRET` que eu tenho guardada?".
- Se for diferente, a função retorna **401 Unauthorized** e bloqueia o acesso.

#### Passo 3: O Acesso Administrativo (Service Role)
Como a Edge Function roda em um ambiente controlado por você, ela tem permissão para usar a **Service Role Key** (Chave Mestra do Supabase).
- Essa chave ignora as regras de RLS (Row Level Security).
- A função diz ao Storage: "Eu sou o administrador do sistema, me dê este arquivo privado agora".

#### Passo 4: O Stream de Dados
O Supabase Storage entrega o arquivo para a Edge Function. A função, por sua vez, "encaminha" o arquivo para o N8N, já definindo o tipo correto (PDF, imagem, etc).

---

## 3. Por que isso é Seguro?
1. **Buckets Permanecem Privados**: Se alguém tentar acessar o arquivo pela URL pública do Supabase, continuará recebendo erro.
2. **Senha Robusta**: Somente quem possui o token de 64 caracteres (N8N) consegue usar o proxy.
3. **Controle Total**: Se você suspeitar de algum problema, basta mudar a Secret no painel do Supabase, e todos os links antigos (mesmo os do Proxy) param de funcionar instantaneamente.

---

## 4. Resumo da Estrutura
- **Cliente (N8N)**: Pede ao Proxy usando uma chave secreta.
- **Proxy (Edge Function)**: Valida a chave e pede ao Storage como Administrador.
- **Storage (Supabase)**: Libera o arquivo apenas para o Proxy.

Esta técnica é o padrão da indústria para comunicações **Machine-to-Machine** (Máquina com Máquina), onde não há um ser humano digitando usuário e senha.

---
**Documentação técnica de apoio para o projeto Lush America Translations.**
