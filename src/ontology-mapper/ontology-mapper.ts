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
import { Optional_Class_Mapping_constructorI, Erasable_Property_Mapping_constructor, Property_Mapping_constructor, Class_Mapping_constructorI } from '../Type/Mapping'
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
                        console.log('Read prefix ' + prefix)
                        this.RDF_handler.prefix_handler.prefix_array.push({
                            uri: iri.id,
                            prefix: prefix
                        })
                    })
                    .on('data', () => { })
                    .on('error', (error: any) => console.error(error))
                    .on('end', () => {
                        console.log('finished reading prefixes from ' + filename)
                    });
                prefixParse.push(stream.finished(prefixStream))
            }

            return Promise.all(prefixParse)
                .then((values) => {
                    console.log(this.RDF_handler.prefix_handler.prefix_array)
                })
                .catch((err) => console.log(err))
        } else {
            const filename = ontologies_path
            const contentType = this.guessContentType(filename)
            return rdfParser.parse(fs.createReadStream(filename), { contentType: contentType })
                .on('prefix', (prefix: string, iri: NamedNode) => {
                    console.log('Read prefix ' + prefix)
                    this.RDF_handler.prefix_handler.prefix_array.push({
                        uri: iri.id,
                        prefix: prefix
                    })
                })
                .on('data', () => { })
                .on('error', (error: any) => console.error(error))
                .on('end', () => {
                    console.log('finished reading prefixes from ' + filename)
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
                        console.log('finished reading quad from ' + filename)

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
                    console.log('finished reading quad from ' + filename)

                });
            allParse.push(stream.finished(parseStream))
            return Promise.all(allParse)
                .then((values) => {

                })
                .catch((err) => console.log(err))
        }


    }

    writeMappings(output_path: string) {
        const mappings = this.mapping_templater()
        const prefixes = this.prefixes_templater()

        fs.writeFileSync(output_path, yaml.dump({ Prefixes: prefixes, Specific: mappings }), { encoding: "utf-8" })
    }

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

    mapping_templater() {
        const mappings: Optional_Class_Mapping_constructorI[] = []
        // Iterate over all concept
        let concepts = Object.values(this.RDF_handler.gql_resources_preprocesing).filter(resource => resource.isConcept && !resource.isAbstract)

        for (let concept of concepts) {
            let entry: Class_Mapping_constructorI = {
                key: this.shortener(concept.class_uri),
                data_properties: [],
                object_properties: []
            };
            (<Erasable_Property_Mapping_constructor[]>entry.object_properties).push(<Erasable_Property_Mapping_constructor>{
                value: concept.class_uri,
                rdf_property: 'rdf:Class'
            })
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
                if (this.RDF_handler.isDatatypeProperty(property)) {
                    // console.log(property_uri + " is a datatype property" + (property.isList ? ' and a list' : ''));

                    (<Erasable_Property_Mapping_constructor[]>entry.data_properties).push(<Erasable_Property_Mapping_constructor>{
                        php_property: this.shortener_property(property.class_uri) + (property.isList ? 's' : ''),
                        rdf_property: this.RDF_handler.prefixer(property.class_uri)
                    })
                } else {
                    // console.log(property_uri + " is an object property" + (property.isList ? ' and a list' : ''));
                    (<Erasable_Property_Mapping_constructor[]>entry.object_properties).push(<Erasable_Property_Mapping_constructor>{
                        php_property: this.shortener_property(property.class_uri) + (property.isList ? 's' : ''),
                        rdf_property: this.RDF_handler.prefixer(property.class_uri)
                    })
                }

            }
            entry.object_properties = array_unifier(<Erasable_Property_Mapping_constructor[]>entry.object_properties)
            entry.data_properties = array_unifier(<Erasable_Property_Mapping_constructor[]>entry.data_properties)

            mappings.push(entry)
        }
        return mappings
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