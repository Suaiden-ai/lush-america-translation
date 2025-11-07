# Configuração do TestSprite MCP no Cursor

## Problema Identificado

O erro `'testsprite-mcp-plugin' não é reconhecido` ocorre porque o Cursor está tentando executar via `npx`, mas no Windows isso pode falhar dependendo da configuração.

## Solução

### Opção 1: Usar o caminho direto do executável (Recomendado)

No arquivo de configuração do MCP do Cursor, use o caminho completo do executável:

```json
{
  "mcpServers": {
    "testsprite": {
      "command": "node",
      "args": [
        "C:\\Users\\victurib\\AppData\\Roaming\\npm\\node_modules\\@testsprite\\testsprite-mcp\\dist\\index.js"
      ]
    }
  }
}
```

### Opção 2: Usar o comando PowerShell diretamente

```json
{
  "mcpServers": {
    "testsprite": {
      "command": "pwsh",
      "args": [
        "-File",
        "C:\\Users\\victurib\\AppData\\Roaming\\npm\\testsprite-mcp-plugin.ps1"
      ]
    }
  }
}
```

### Opção 3: Usar npx com caminho completo do node

```json
{
  "mcpServers": {
    "testsprite": {
      "command": "npx",
      "args": [
        "-y",
        "@testsprite/testsprite-mcp@latest"
      ],
      "env": {
        "PATH": "C:\\Program Files\\nodejs;%PATH%"
      }
    }
  }
}
```

## Localização do Arquivo de Configuração

O arquivo de configuração do MCP do Cursor geralmente está em:
- **Windows**: `%APPDATA%\Cursor\User\globalStorage\mcp.json`
- Ou nas configurações do workspace: `.cursor/mcp.json`

## Verificação

Para verificar se o comando funciona:
```powershell
testsprite-mcp-plugin --version
```

Deve retornar: `1.0.0`

## Observações

- Os avisos `npm warn tar TAR_ENTRY_ERROR ENOENT` são normais e não impedem o funcionamento
- O pacote está instalado corretamente em: `C:\Users\victurib\AppData\Roaming\npm\node_modules\@testsprite\testsprite-mcp`








