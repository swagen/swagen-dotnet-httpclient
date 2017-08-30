'use strict';

const fs = require('fs');

const definition = require('./definition.json');
const profile = require('./profile.json');
const Generator = require('../lib/csharp');

const generator = new Generator(definition, profile);
const code = generator.generate();

fs.writeFileSync('./test-harness/output.cs', code, 'utf8');
