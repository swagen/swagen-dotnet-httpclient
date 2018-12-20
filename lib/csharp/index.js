const prompts = require('./prompts');
const buildProfile = require('./build-config');
const validateProfile = require('./validate-profile').default;
const generate = require('./generate');

module.exports = {
    name: 'csharp',
    description: '.NET C# client with HttpClient',
    language: 'C#',
    extension: 'cs',
    prompts,
    defaultTransforms: {
        serviceName: ['pascal-case'],
        operationName: ['pascal-case'],
        parameterName: ['camel-case'],
        modelName: ['pascal-case'],
        propertyName: ['pascal-case']
    },
    buildProfile,
    validateProfile,
    generate
};
