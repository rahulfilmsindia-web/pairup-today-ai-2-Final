$src = "C:\Users\ADMIN\Downloads\pairup-today-ai-2ai"
$zip = "C:\Users\ADMIN\Downloads\pairuptoday-source.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }

$items = Get-ChildItem -Path $src | Where-Object { 
    $_.Name -notin @('node_modules', '.git', 'dist', 'dist-admin') -and 
    $_.Name -notmatch '\.exe($|-)' 
}

Write-Host "Compressing $($items.Count) root items into $zip..."
Compress-Archive -Path $items.FullName -DestinationPath $zip -CompressionLevel Optimal
$size = [math]::Round((Get-Item $zip).Length / 1MB, 2)
Write-Host "Success! Created $zip ($size MB)"
