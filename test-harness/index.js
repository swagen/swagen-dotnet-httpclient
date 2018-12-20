'use strict';

const fs = require('fs');

const modeName = 'csharp';

const definition = require('./definition.json');
const profile = require('./profile.json');

const selectedMode = require('../lib/' + modeName);

if (typeof selectedMode.validateProfile === 'function') {
    selectedMode.validateProfile(profile);
}

const code = selectedMode.generate(definition, profile);

fs.writeFileSync(`./test-harness/output.${selectedMode.extension}`, code, 'utf8');
