# Lance ce script depuis la racine du projet MadaBienEtre.
# Il recherche les connexions WebSocket qui peuvent encore utiliser un chemin relatif.
$files = Get-ChildItem . -Recurse -File -Include *.js,*.jsx,*.ts,*.tsx |
  Where-Object { $_.FullName -notmatch '\\node_modules\\|\\.expo\\|\\android\\build\\|\\ios\\build\\' }
$matches = $files | Select-String -Pattern 'new\s+WebSocket\s*\(|/ws/|websocketService\.connect\s*\('
if ($matches) {
  $matches | ForEach-Object { "{0}:{1}: {2}" -f $_.Path, $_.LineNumber, $_.Line.Trim() }
} else {
  Write-Host 'Aucun appel WebSocket trouvé.'
}
