Set-Location 'c:\Users\victurib\lush\lush-america-translation'

# Criar pastas se não existirem
if (-not (Test-Path 'docs')) { New-Item -ItemType Directory -Path 'docs' }
if (-not (Test-Path 'sql')) { New-Item -ItemType Directory -Path 'sql' }

# Mover arquivos .md (exceto README.md)
Get-ChildItem -Filter '*.md' -File | Where-Object { $_.Name -ne 'README.md' } | ForEach-Object {
    Move-Item -Path $_.FullName -Destination 'docs\' -Force
    Write-Host "Movido: $($_.Name)"
}

# Mover arquivos .sql (exceto os que estão em supabase/migrations)
Get-ChildItem -Filter '*.sql' -File | Where-Object { $_.FullName -notlike '*supabase\migrations\*' } | ForEach-Object {
    Move-Item -Path $_.FullName -Destination 'sql\' -Force
    Write-Host "Movido: $($_.Name)"
}

Write-Host "Organizacao concluida!"
