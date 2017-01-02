'use strict';

const modeMappings = {
    csharp: 'csharp',
    'c#': 'csharp',
    'cs': 'csharp'
};

function generate(definition, profile) {
    let mode = modeMappings[profile.mode || 'csharp'];
    let Generator = require(`./lib/${mode}`);
    let generator = new Generator(definition, profile);
    return generator.generate();
}

function validate(profile) {
    let options = profile.options;
    if (!options) {
        throw `Specify an 'options' section in your profile.`;
    }
    if (!options.namespaces) {
        throw `Specify an 'options.namespaces' section in your profile.`;
    }
    if (!options.namespaces.services || !options.namespaces.models) {
        throw `Specify namespaces for services and models under the 'options.namespaces' section using keys 'services' and 'models'.`;
    }
}

module.exports = {
    modes: require('./lib/metadata'),
    generate: generate,
    validateProfile: validate
};
