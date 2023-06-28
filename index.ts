import * as commander from 'commander'
import * as path from 'path';
import * as fs from 'fs-extra'
import OWL_Mapper from './src/ontology-mapper/ontology-mapper'
import * as dotenv from 'dotenv'

const cli = new commander.Command()
const BASE_CALL_DIR = process.cwd()

dotenv.config()

export const module = {
    async execute(ontologies_folder: string, generated_mapping: string, additional_prefix_array?: string[]) {
        const rdf_service = await OWL_Mapper.getInstance(ontologies_folder, additional_prefix_array)
        fs.ensureDirSync(path.dirname(generated_mapping))
        rdf_service.writeMappings(generated_mapping)
    }
}