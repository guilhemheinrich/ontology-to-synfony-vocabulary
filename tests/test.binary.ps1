# Obtenir le chemin complet du répertoire du script en cours
$scriptPath = $PSScriptRoot

# Concaténer un chemin relatif à partir de l'emplacement du script
$exePath = Join-Path -Path $scriptPath -ChildPath "ontology-to-synfony-vocabulary.exe"
$ontologyPath = Join-Path -Path $scriptPath -ChildPath "ontologies"
$entitiesPath = Join-Path -Path $scriptPath -ChildPath "entity_mappings.txt"
$outputPah = Join-Path -Path $scriptPath -ChildPath "../generated/resources.yaml"
# Vérifier si le fichier binaire existe
if (Test-Path $exePath -PathType Leaf) {
    # Exécuter le fichier binaire
    # Arguments à passer au fichier binaire
    $arguments = "$ontologyPath", "$entitiesPath", "$outputPah"
    Start-Process -FilePath $exePath -ArgumentList $arguments -NoNewWindow -Wait
} else {
    Write-Host "Le fichier binaire n'existe pas dans le chemin spécifié."
}