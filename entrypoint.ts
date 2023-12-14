import * as path from 'path';
import * as fs from 'fs-extra'
import OWL_Mapper from './src/ontology-mapper/ontology-mapper'
import { generateEntityMappings } from './src/synfony-pass';

const ontology_path = path.join('/', 'app','ontology');
const synfony_entities_path = path.join('/', 'app','synfony_entities');
const output_path = path.join('/', 'app','output_path', 'generated.yaml');

const isFolder = fs.lstatSync(ontology_path).isDirectory()
console.log(`
${isFolder? 'Folder' : 'File'} with ontology content is ${ontology_path}
File containg synfony entities is ${synfony_entities_path}
Generated synfony resource file is ${output_path}

This code is from https://github.com/guilhemheinrich/ontology-to-synfony-vocabulary`)

const main = {
    async execute(ontologies_folder: string, generated_mapping: string, synfony_mappings: {[entity_key: string]: string}, additional_prefix_array?: string[]) { 
        const rdf_service = await OWL_Mapper.getInstance(ontologies_folder, additional_prefix_array)
        fs.ensureDirSync(path.dirname(generated_mapping))    
        const {unmatched_concepts, unmatched_entities} = rdf_service.writeMappings(generated_mapping, synfony_mappings)
        console.warn(`
${unmatched_concepts.length} unmatched concepts (present in ontology file, but not in synfony entities):
\t${unmatched_concepts.join('\n\t')}

${unmatched_entities.length} unmatched entities (present in synfony entites file, but not in ontology file):
\t${unmatched_entities.join('\n\t')}
        `)
    }
}

const synfony_mappings = generateEntityMappings(synfony_entities_path)
main.execute(ontology_path, output_path, synfony_mappings)