# Adapt path to be absolute

docker run --rm -it -v D:/code/DEEPOMICS/deepomics-ontology/ontologies:/app/ontology -v D:/code/DEEPOMICS/ontology-to-synfony-vocabulary/generated:/app/output_path -v D:/code/DEEPOMICS/ontology-to-synfony-vocabulary/entity_mappings.txt:/app/synfony_entities onto-mapper