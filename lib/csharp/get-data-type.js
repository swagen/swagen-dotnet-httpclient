'use strict';

const _ = require('lodash');

function getDataType(property, name, skipPrefix) {
    let typeName = property.primitive ? getPrimitiveTypeName(property, name, skipPrefix) : prefixNamespace(property.complex, skipPrefix);
    if (property.isArray) {
        typeName = `IReadOnlyList<${typeName}>`
    }
    return typeName;
}

function getPrimitiveTypeName(property, name, skipPrefix) {
    switch (property.primitive) {
        case 'integer':
            switch (property.subType) {
                case 'int32':
                    return 'int';
                case 'int64':
                    return 'long';
                default:
                    return 'int';
            }
        case 'number':
            return property.subType || 'double';
        case 'string': {
            switch (property.subType) {
                case 'date-time':
                case 'date':
                    return 'DateTime';
                case 'uuid':
                case 'byte':
                case 'password':
                    return 'string';
                case 'enum':
                    return prefixNamespace(`${_.upperFirst(_.camelCase(name))}Enum`, skipPrefix);
                default:
                    return 'string';
            }
        }
        case 'boolean':
            return 'bool';
        case 'file':
        case 'object':
            return 'object';
        case 'array':
            return 'object[]';
        default:
            throw `Cannot translate primitive type ${JSON.stringify(property, null, 4)}`;
    }
}

function prefixNamespace(dataType, skipPrefix) {
    return skipPrefix ? dataType : `__models.${dataType}`;
}

module.exports = getDataType;
