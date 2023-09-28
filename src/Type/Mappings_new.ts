export interface Resources_MappingI {
    [entity_qualified_path: string]: Class_MappingI
}

export interface Class_MappingI {
    'iri': string
    properties: {[php_property: string]: Property_MappingI}
}

export interface Property_MappingI {
    attributes: {
        jsonld_context: {
            '@id': string
            '@type'?: string
        }
    }
}





// const test: Resources_MappingI = {
//     "App/Entity/Metadata/Inputs/BiomassCommonName": {
//         '@type': 'http://deepomics',
//         properties: {
//             name: {
//                 '@id': "rdfs:label"
//             }
//         }
//     }
// }