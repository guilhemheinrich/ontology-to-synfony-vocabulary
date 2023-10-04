import * as commander from 'commander'
import * as path from 'path';
import * as fs from 'fs-extra'
import OWL_Mapper from './src/ontology-mapper/ontology-mapper'
import * as dotenv from 'dotenv'
import { generateEntityMappings } from './src/synfony-pass';
const BASE_CALL_DIR = process.cwd()

dotenv.config()
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
const cli = new commander.Command()
cli
    .argument('[ontologyPath]', "Path to a file or folder containing ontologies file (rdf/owl)", "D:/code/DEEPOMICS/deepomics-ontology/ontologies/deepomics-core.owl")
    .argument('[synfonyEntitiesPath]', "Path to the file containing fully qualified synfony enities name", "./entity_mappings.txt")
    .argument('[outputPath]', "Path to the generated synfony's resource's config's .yaml file", "./out/generated_bis.yaml")
    .action(function (ontologyPath, synfonyEntitiesPath, outputPath) {
        const ontology_path = path.resolve(ontologyPath);
        const synfony_entities_path = path.resolve(synfonyEntitiesPath);
        const output_path = path.resolve(outputPath);
        const isFolder = fs.lstatSync(ontology_path).isDirectory()
        console.log(`
        ${isFolder? 'Folder' : 'File'} with ontology content is ${ontology_path}
        File containg synfony entities is ${synfony_entities_path}
        Generated synfony resource file is ${output_path}

        This code is from https://github.com/guilhemheinrich/ontology-to-synfony-vocabulary`)
        const synfony_mappings = generateEntityMappings(synfony_entities_path)
        main.execute(ontology_path, output_path, synfony_mappings)
    })
cli.parse(process.argv)









// module.execute("D:/code/DEEPOMICS/deepomics-ontology/ontologies/deepomics-core.owl", "./out/generated_bis.yaml", "./entity_mappings.txt")
