import * as dotenv from 'dotenv'
import rdfParser from "rdf-parse"
import { Quad } from "rdf-js"
import fs from 'fs-extra'
import path from 'path'
import yaml from 'js-yaml'
import { walker_recursive_sync } from '../Helper/walker'
import camelize from '../Helper/camelize'
import array_unifier from '../Helper/array_unifier'
import { Owl_Parser } from './processRdf'
// import { Optional_Class_Mapping_constructorI, Erasable_Property_Mapping_constructor, Property_Mapping_constructor, Class_Mapping_constructorI } from '../Type/Mapping'
import {Resources_MappingI, Class_MappingI, Property_MappingI} from '../Type/Mappings_new'
import * as stream from 'stream/promises'
import { NamedNode } from 'n3'
dotenv.config()

export default class OWL_Mapper {
    private static instance: OWL_Mapper

    ontologie_triple: Quad[] = []
    RDF_handler: Owl_Parser

    private constructor(additional_prefix_array: string[] = []) {
        this.RDF_handler = new Owl_Parser(additional_prefix_array) 
    }

    static async getInstance(ontologies_source_path: string, additional_prefix_array: string[] = []) {
        if (!this.instance) {
            this.instance = new OWL_Mapper(additional_prefix_array)
            await this.instance.initializePrefixes(ontologies_source_path)
            await this.instance.initializeOntologie(ontologies_source_path)
        }
        return this.instance
    }

    private guessContentType(filename: string) {
        let contentType = ''
        switch (path.extname(filename)) {
            case '.ttl':
                contentType = 'text/turtle'
                break;
            case '.owl':
            case '.rdf':
                contentType = 'application/rdf+xml'
                break;
        }
        return contentType
    }

    private async initializePrefixes(ontologies_source_path: string) {
        const ontologies_path = ontologies_source_path
        const prefixParse: Promise<unknown>[] = []

        if (fs.lstatSync(ontologies_path).isDirectory()) {
            for (const filename of walker_recursive_sync(ontologies_path)) {
                const contentType = this.guessContentType(filename)
                const prefixStream = rdfParser.parse(fs.createReadStream(filename), { contentType: contentType })
                    .on('prefix', (prefix: string, iri: NamedNode) => {
                        // console.log('Read prefix ' + prefix)
                        this.RDF_handler.prefix_handler.prefix_array.push({
                            uri: iri.id,
                            prefix: prefix
                        })
                    })
                    .on('data', () => { })
                    .on('error', (error: any) => console.error(error))
                    .on('end', () => {
                        // console.log('finished reading prefixes from ' + filename)
                    });
                prefixParse.push(stream.finished(prefixStream))
            }

            return Promise.all(prefixParse)
                .then((values) => {
                    // console.log(this.RDF_handler.prefix_handler.prefix_array)
                })
                .catch((err) => {
                    console.error(err)
                })
        } else {
            const filename = ontologies_path
            const contentType = this.guessContentType(filename)
            return rdfParser.parse(fs.createReadStream(filename), { contentType: contentType })
                .on('prefix', (prefix: string, iri: NamedNode) => {
                    // console.log('Read prefix ' + prefix)
                    this.RDF_handler.prefix_handler.prefix_array.push({
                        uri: iri.id,
                        prefix: prefix
                    })
                })
                .on('data', () => { })
                .on('error', (error: any) => console.error(error))
                .on('end', () => {
                    // console.log('finished reading prefixes from ' + filename)
                });
        }

    }

    private async initializeOntologie(ontologies_source_path: string) {
        const ontologies_path = ontologies_source_path
        // const prefixParse: Promise<unknown>[] = []
        const allParse: Promise<unknown>[] = []
        if (fs.lstatSync(ontologies_path).isDirectory()) {
            for (const filename of walker_recursive_sync(ontologies_path)) {
                const contentType = this.guessContentType(filename)
                const parseStream = rdfParser.parse(fs.createReadStream(filename), { contentType: contentType })
                    .on('data', (quad: Quad) => {
                        this.RDF_handler.processRdf(quad)
                    })
                    .on('error', (error: any) => console.error(error))
                    .on('end', () => {
                        // console.log('finished reading quad from ' + filename)

                    });
                allParse.push(stream.finished(parseStream))
            }
            return Promise.all(allParse)
                .then((values) => {

                })
                .catch((err) => console.log(err))
        } else {
            const filename = ontologies_path
            const contentType = this.guessContentType(filename)
            const parseStream = rdfParser.parse(fs.createReadStream(filename), { contentType: contentType })
                .on('data', (quad: Quad) => {
                    this.RDF_handler.processRdf(quad)
                })
                .on('error', (error: any) => console.error(error))
                .on('end', () => {
                    // console.log('finished reading quad from ' + filename)

                });
            allParse.push(stream.finished(parseStream))
            return Promise.all(allParse)
                .then((values) => {

                })
                .catch((err) => console.log(err))
        }


    }

    writeMappings(output_path: string, entity_mappings?: {[key: string]: string}) {
        const {mappings, unmatched_concepts, unmatched_entities} = this.mapping_templater(entity_mappings)
        const prefixes = this.prefixes_templater()

        fs.writeFileSync(output_path, yaml.dump({ resources: mappings }), { encoding: "utf-8" })
        return {
            unmatched_concepts,
            unmatched_entities
        }
    }

    // TODO Gérer le cas ou l'on a une notation préfixé ns:classname => renvoyé classname
    shortener(uri: string) {
        // Extremely permissive url SchemaMetaFieldDef, but lead to error: (^[^#]*[\/#])([^/#]*)$
        const uri_separator = new RegExp(/(^.*[\/#])([\d\w]*)$/gm)
        let matches = uri.matchAll(uri_separator)
        const _array = Array.from(matches)
        if (_array && _array.length > 0) {
            let prefix = _array[0][1]
            if (false) {
                let found_prefix = this.RDF_handler.prefix_handler.getPrefixAndUriFromUri(prefix)
                return found_prefix?.prefix + '__' + _array[0][2]
            } else {
                // console.log(`${uri} is not found`)
                return _array[0][2]
            }
        } else {
            return uri
        }
    }

    shortener_property(uri: string): string {
        const shorten_pass = this.shortener(uri)
        if (shorten_pass.startsWith("has")) {
            return camelize(shorten_pass.slice(3))
        }
        return shorten_pass
    }

    mapping_templater(entity_mappings?: {[entity_key: string]: string}) {
        const mappings: Resources_MappingI = {}
        // Iterate over all concept
        const concepts = Object.values(this.RDF_handler.gql_resources_preprocesing).filter(resource => resource.isConcept && !resource.isAbstract)
        // Log the unmatched concept during the mapping phase
        const unmatched_concepts: string[] = []
        
        for (let concept of concepts) {
            let entity_qualified_path = this.shortener(concept.class_uri)
            if (entity_mappings) {
                if (entity_mappings[entity_qualified_path]) {
                    entity_qualified_path = entity_mappings[entity_qualified_path]
                } else {
                    //! We just drop the resource, as it incorrect resource provoke a bug in Synfony
                    unmatched_concepts.push(concept.class_uri)
                    // console.warn(`${entity_qualified_path} is not a recognized resource, therefore it will be dropped from the generation`)
                    continue
                }
            } 

            // Comment peut on aligner une class sur une resource précise / comment modifier le @type
            let class_entry: Class_MappingI = {
                'iri': concept.class_uri,
                properties: {}
            };
            // ! La class devrait être gérer avec @type
            // (<Erasable_Property_Mapping_constructor[]>entry.object_properties).push(<Erasable_Property_Mapping_constructor>{
            //     value: concept.class_uri,
            //     rdf_property: 'rdf:Class'
            // })
            const restrictions = this.RDF_handler.getRestrictions(concept.class_uri)
            // Iterate over properties
            const all_properties = this.RDF_handler.getInheritedValues(concept.class_uri, "properties")
                .reduce((acculmulator, value) => {
                    return [...acculmulator, ...value]
                }, [])
            for (let property_uri of all_properties) {

                // * Deep copy property then walk through restrictions to update
                const property: typeof this.RDF_handler.gql_resources_preprocesing[typeof property_uri] = JSON.parse(JSON.stringify(this.RDF_handler.gql_resources_preprocesing[property_uri]))
                // Skip the property if it is an annotation property
                if (this.RDF_handler.isAnnotationProperty(property)) continue
                //Filter restrictions applying to the current property
                const relevant_restrictions = restrictions.filter((restriction) => {
                    return restriction.property_uri == property_uri
                })
                for (let relevant_restriction of relevant_restrictions) {
                    // * Doesn't enforce VALIDATION of owl rules
                    // * It means that no output will be generated if we got two contrary rules 
                    property.isList = relevant_restriction.isList
                    property.isRequired = relevant_restriction.isRequired
                    // console.log('Found restriction on property ' + property.name + ' on class ' + concept.name)
                    // console.log(property)
                }
                // TODO Right now we are doig the same, but we could/sould handle xml:Types when possible
                
                const key = this.shortener_property(property.class_uri) + (property.isList ? 's' : '');
                const property_entry: Property_MappingI = {
                    attributes: {
                        jsonld_context: {
                            '@id': property.class_uri,
                            '@type': property.type
                        }
                    }
                }; 
                if (this.RDF_handler.isDatatypeProperty(property)) {
                    // console.log(property_uri + " is a datatype property" + (property.isList ? ' and a list' : ''));

                } else {

                }
                class_entry.properties[key] = property_entry

            }

            mappings[entity_qualified_path] = class_entry
        }
        // Grab the unmatched entities by set difference
        const unmatched_entities: string[] = []
        for (let key in entity_mappings) {
            if (!(Object.keys(mappings)).includes(entity_mappings[key])) {
                unmatched_entities.push(entity_mappings[key])
            }
        }
        return {
            mappings: mappings, 
            unmatched_concepts: unmatched_concepts, 
            unmatched_entities: unmatched_entities
        }
    }

    prefixes_templater() {
        return array_unifier(this.RDF_handler.prefix_handler.prefix_array).map((prefix_entry) => {
            return {
                key: prefix_entry.prefix,
                value: prefix_entry.uri
            }
        })
    }
}