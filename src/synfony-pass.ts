// This file parse a file generated via Synfony of qualified name to associate rdf resource name to such entity

import * as fs from 'fs-extra'
import path from 'path'
import yaml from 'js-yaml'
const ENTITY_MAPPINGS_FILE_PATH = path.join(__dirname, '../entity_mappings.txt')

//* Following regex pattern identifies correct pattern for such input:
//* Nom de l'entité : App\Entity\Metadata\Industrial\Processes\AnaerobicDigestionWetProcess
//* Nom de l'entité : App\Entity\Metadata\Industrial\Site
//* Nom de l'entité : App\Entity\Metadata\PhysicalState
const REGEX_PATTERN = new RegExp(/\s+(?<qualified>([a-zA-Z]+\\)+)(?<entity>\w+)\s+/gm)

const content = fs.readFileSync(ENTITY_MAPPINGS_FILE_PATH, {encoding: 'utf-8'})
const matches = content.matchAll(REGEX_PATTERN)
export const synfony_mappings: {[entity_key: string]: string} = {}
for (let match of matches) {
    if (match.groups) {
        const qualified = match.groups['qualified']
        const entity = match.groups['entity']
        synfony_mappings[entity] = qualified + entity
    }  
}

// yaml.dump(synfony_mappings)
// fs.writeFileSync('test.yaml', yaml.dump(synfony_mappings))
// console.log(synfony_mappings)