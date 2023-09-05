import { stringify } from "querystring"
import { Quad } from "rdf-js"
import Prefixer from "./prefixes/Prefix";
import standardPrefix from "./prefixes/standard_prefixes.json"
export interface Gql_Resource {
    // Graphql layer
    class_uri: string,
    name: string,
    isConcept: boolean
    // RDF layer
    isAbstract: boolean         // In case of a blank node
    class: string
    properties: Array<keyof Gql_Resource_Dictionary>        // Liste des propriétés
    inherits: Array<keyof Gql_Resource_Dictionary>          // gestion de la chaine d'héritage, non géré de base dans graphQL

    // Properties specific
    type: string,
    domains: string[]
    // OWL restriction layer
    isRequired: boolean
    isList: boolean
    property_uri?: string

}
export interface _Porperty_Template {
    type: "Object" | "Litteral"
    name: string
    valuetype: string
    // isRequired: boolean
    // isList: boolean
}

export interface ObjectProperty_Template extends _Porperty_Template {
    type: "Object"
}

export interface DatatypeProperty_Template extends _Porperty_Template {
    type: "Litteral"
    name: string
    valuetype: "String" | "Int" | "Float" | "Boolean" | "Null" | "ID" | "Date" | "DateTime"
}

export type PorpertyTemplate = ObjectProperty_Template | DatatypeProperty_Template



class Gql_Resource_Dictionary {
    [uri: string]: Gql_Resource
    constructor() {
        const handler = {
            get: function (target: Gql_Resource_Dictionary, prop: string) {
                if (!Object.keys(target).includes(prop)) {
                    target[prop] = {
                        class_uri: prop,                // Initialize with the uri
                        name: prop,                     // Initialize with the uri
                        class: "owl:Thing",
                        isConcept: false,
                        isAbstract: false,
                        properties: [],
                        inherits: [],
                        domains: [],
                        type: '',
                        isRequired: false,
                        isList: true
                    }
                }
                return Reflect.get(target, prop)
            }
        }
        return new Proxy(this, handler)
    }
}
export class Owl_Parser {

    static options = {
        // Additional label to add to every node
        additionalNodeLabels: [
            "Resource"              // Resource label is the default when manipulating rdf with n10s
                                    // It includes URI field constraint
        ]
    } 


    prefix_handler: Prefixer
    readonly gql_resources_preprocesing: Gql_Resource_Dictionary = new Gql_Resource_Dictionary()

    /**
     * Creates an instance of Owl_Parser.
     * @date 23/11/2021
     * @param {{prefix: string, uri: string}[]} prefixes_array
     * @memberof Owl_Parser
     */
    constructor(array_pathes_to_prefixes: string[] = []) {
        // Add owl:Thing in gqlResource
        this.prefix_handler = new Prefixer(array_pathes_to_prefixes)
        this.gql_resources_preprocesing[this.expender('owl:Thing')] = {
            class_uri: this.expender('owl:Thing'),                  // Initialize with the uri
            name: "Thing",                                          // Initialize with the uri
            class: "owl:Thing",
            isConcept: true,
            isAbstract: false,
            properties: [],
            inherits: [],
            domains: [],
            type: '',
            isRequired: false,
            isList: false
        }
    }


    /**
     * @description 
     * Transform a regular uri with a prefixed rdf format, according to the prefixes_array, or to the Prefixer class routine
     * @date 04/04/2022
     * @example http://my/ontologie#item => ontology_prefix:item
     * @param {string} uri
     * @return {*}  {string} Return the uri with prefixed format
     * @memberof Owl_Parser
     */
    prefixer(uri: string): string {
        let prefix_uri = this.prefix_handler.getPrefixAndUriFromUri(uri)
        return uri.replace(prefix_uri.uri, prefix_uri.prefix + ':')
    }

    /**
     * @description
     * Transform a short prefixed uri into long format uri
     * @date 07/03/2022
     * @example ontology_prefix:item => http://my/ontologie#item
     * @param {string} short_uri
     * @return {*}  {string}
     * @memberof Owl_Parser
     */
    expender(short_uri: string): string {
        let [prefix, suffix] = short_uri.split(':')
        let found_prefix = this.prefix_handler.getPrefixAndUriFromPrefix(prefix)
        if (found_prefix != undefined) {
            return found_prefix.uri + suffix
        } else {
            console.warn(`${prefix} is not in the prefix list`)
        }
        return short_uri
    }

    /**
     * @description
     * Internal function to shorten the rdf class uri to a gql type
     * @date 16/03/2022
     * @param {string} class_uri
     * @param {boolean} n10s_compliant
     * @return {*}  {string}
     * @memberof Owl_Parser
     */
    shortener(class_uri: string, n10s_compliant: boolean = true): string {
        // Extremely permissive url SchemaMetaFieldDef, but lead to error: (^[^#]*[\/#])([^/#]*)$
        const uri_separator = new RegExp(/(^.*[\/#])([\d\w]*)$/gm)
        let matches = class_uri.matchAll(uri_separator)
        const _array = Array.from(matches)
        if (_array && _array.length > 0) {
            let prefix = _array[0][1]
            if (n10s_compliant) {
                let found_prefix = this.prefix_handler.getPrefixAndUriFromUri(prefix)
                return found_prefix?.prefix + '__' + _array[0][2]
            } else {
                console.log(`${class_uri} is not found`)
                return _array[0][2]
            }
        } else {
            return class_uri
        }

    }

    getInheritedValues(uri: keyof Gql_Resource_Dictionary, key: "properties"): Array<Array<keyof Gql_Resource_Dictionary>>
    getInheritedValues(uri: keyof Gql_Resource_Dictionary, key: "inherits"): Array<Array<keyof Gql_Resource_Dictionary>>
    getInheritedValues(uri: keyof Gql_Resource_Dictionary, key: "type"): Array<string>
    getInheritedValues(uri: keyof Gql_Resource_Dictionary, key: "class"): Array<string>
    getInheritedValues(uri: keyof Gql_Resource_Dictionary, key: keyof Gql_Resource): Array<Gql_Resource[typeof key]> {
        let inherited_values: Array<Gql_Resource[typeof key]> = []

        const looper = (uri: keyof Gql_Resource_Dictionary) => {
            const inheritance = this.gql_resources_preprocesing[uri].inherits
            inherited_values.push(this.gql_resources_preprocesing[uri][key])
            inheritance.forEach((uri_next) => looper(uri_next))
        }

        looper(uri)
        return inherited_values
    }

    getRestrictions(uri: keyof Gql_Resource_Dictionary) {
        const inheritance_chain = this.getInheritedValues(uri, "inherits")
        return inheritance_chain
            .reduce((accumulator, current_value) => {
                return [...accumulator, ...current_value]
            }, [])
            .map((uri) => this.gql_resources_preprocesing[uri])
            .filter((value) => {
                return value.class === this.expender('owl:Restriction')
            })
    }

    isAnnotationProperty(resource: Gql_Resource) {
        const properties_inheritance = this.getInheritedValues(resource.class_uri, "class")
        return properties_inheritance.includes(this.expender("owl:AnnotationProperty"))
    }

    isObjectProperty(resource: Gql_Resource) {
        const properties_inheritance = this.getInheritedValues(resource.class_uri, "class")
        return properties_inheritance.includes(this.expender("owl:ObjectProperty"))
    }

    isDatatypeProperty(resource: Gql_Resource) {
        const properties_inheritance = this.getInheritedValues(resource.class_uri, "class")
        return properties_inheritance.includes(this.expender("owl:DatatypeProperty"))
    }

    processRdf(quad: Quad) {
        // Some aliases
        let subject = quad.subject.value
        let blank_node = (quad.subject.termType == "BlankNode")
        let predicate = quad.predicate.value
        let object = quad.object.value
        this.gql_resources_preprocesing[subject].isAbstract = blank_node
        let cardinality = 0
        switch (this.prefixer(predicate)) {
            //            _  __         __      _  __ 
            //           | |/ _|       / /     | |/ _|
            //    _ __ __| | |_ ___   / / __ __| | |_ 
            //   | '__/ _` |  _/ __| / / '__/ _` |  _|
            //   | | | (_| | | \__ \/ /| | | (_| | |  
            //   |_|  \__,_|_| |___/_/ |_|  \__,_|_|  
            //                                        
            //     
            case "ns:type":
            case "a":
                // checkExistence(subject)
                switch (this.prefixer(object)) {
                    case "owl:Class":
                    case "rdfs:Class":
                        this.gql_resources_preprocesing[subject].isConcept = true
                        // TODO nop, pas de domaine de base sur owl:Thing, tyéfououkoi
                        // de plus, rdfs:domain se combine en union: https://perso.liris.cnrs.fr/pierre-antoine.champin/2001/rdf-tutorial/node15.html
                        // this.gql_resources_preprocesing[subject].inherits.push(this.expender('owl:Thing'))
                        break
                    case "owl:ObjectProperty":
                    case "owl:DatatypeProperty":
                        // this.gql_resources_preprocesing[subject].domains.push(this.expender('owl:Thing'))
                        // this.gql_resources_preprocesing[this.expender('owl:Thing')].properties.push(subject)
                        break
                    case "owl:Restriction":
                        break
                    case "ns:Property":
                        this.gql_resources_preprocesing[subject].isConcept = false
                        break
                    default:
                }
                this.gql_resources_preprocesing[subject].class = object
                break
            case "rdfs:subPropertyOf":
                this.gql_resources_preprocesing[subject].inherits.push(object)
                break
            case "rdfs:subClassOf":
                this.gql_resources_preprocesing[subject].inherits.push(object)
                break
            case "rdfs:label":
                // TODO Handle __type of the class, or something else...
                this.gql_resources_preprocesing[subject].name = object
                break
            case "rdfs:comment":
                break
            case "rdfs:range":
                this.gql_resources_preprocesing[subject].type = object
                break
            case "rdfs:domain":
                // It's here that we know which properties are on which class
                this.gql_resources_preprocesing[object].properties.push(subject)
                this.gql_resources_preprocesing[subject].domains.push(object)
                break
            // TODO List comprehension
            case "rdfs:Container":
            case "rdfs:Bags":
            case "rdfs:Seq":
            case "rdfs:Alt":
                break;
            //                  _ 
            //                 | |
            //     _____      _| |
            //    / _ \ \ /\ / / |
            //   | (_) \ V  V /| |
            //    \___/ \_/\_/ |_|
            //                    
            // 
            case "owl:onProperty":
                this.gql_resources_preprocesing[subject].property_uri = object
                break
            case "owl:someValuesFrom":
                console.log(`${subject} ${predicate} ${object}`)
                break
            case "owl:minQualifiedCardinality":
            case "owl:minCardinality":
                cardinality = Number(object)
                if (cardinality >= 1) {
                    this.gql_resources_preprocesing[subject].isRequired = true
                }
                console.log(`${subject} ${predicate} ${object}`)
                break
            case "owl:maxQualifiedCardinality":
            case "owl:maxCardinality":
                cardinality = Number(object)
                if (cardinality <= 1) {
                    this.gql_resources_preprocesing[subject].isList = false
                }
                console.log(`${subject} ${predicate} ${object}`)
                break
            case "owl:qualifiedCardinality":
            case "owl:cardinality":
                cardinality = Number(object)
                this.gql_resources_preprocesing[subject].isRequired = true
                if (cardinality == 1) {
                    this.gql_resources_preprocesing[subject].isList = false
                }
                console.log(`${subject} ${predicate} ${object}`)
                break
            case "owl:onDataRange":
                console.log(`${subject} ${predicate} ${object}`)
                break
            case "owl:onClass":
                console.log(`${subject} ${predicate} ${object}`)
                break
            default:

        }
    }

}

export const RDF_parser = new Owl_Parser()
export default RDF_parser


