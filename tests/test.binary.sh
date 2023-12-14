#!/bin/bash

#! Didn't worked on WSL, probably due to the way WSL handle path between the VM and the windows filesystem
# Obtenir le chemin complet du répertoire du script en cours
scriptPath=$(dirname "$(readlink -f "$0")")

# Concaténer un chemin relatif à partir de l'emplacement du script
exePath="$scriptPath/ontology-to-synfony-vocabulary.exe"
ontologyPath="$scriptPath/ontologies"
entitiesPath="$scriptPath/entity_mappings.txt"
outputPath="$scriptPath/../generated/resources.yaml"

# Vérifier si le fichier binaire existe
if [ -f "$exePath" ]; then
    # Exécuter le fichier binaire
    # Arguments à passer au fichier binaire
    arguments=("$ontologyPath" "$entitiesPath" "$outputPath")
    # arguments=("--help")
    "$exePath" "${arguments[@]}"
else
    echo "Le fichier binaire n'existe pas dans le chemin spécifié."
fi
