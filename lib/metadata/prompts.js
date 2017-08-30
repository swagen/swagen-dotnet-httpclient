module.exports = [
    {
        type: 'checkbox',
        name: 'generate',
        message: 'What do you want to generate?',
        choices: [
            { name: 'Service implementation', value: 'impl', checked: true },
            { name: 'Model classes', value: 'model', checked: true },
            { name: 'Service interfaces', value: 'intf', checked: false },
            { name: 'Shared code (per namespace)', value: 'shared', checked: true }
        ],
        validate: (input, answers) => input.length > 0
    },
    {
        when: answers => answers.generate.some(gen => gen === 'impl' || gen === 'intf'),
        type: 'input',
        name: 'servicesns',
        message: 'Services namespace',
        validate: value => !!value
    },
    {
        when: answers => answers.generate.some(gen => gen === 'model'),
        type: 'input',
        name: 'modelsns',
        message: 'Models namespace',
        validate: value => !!value,
        default: answers => answers.servicesns
    },
    {
        type: 'list',
        name: 'accessType',
        message: 'Access level for generated types',
        choices: [
            { name: 'public', value: 'public' },
            { name: 'internal', value: 'internal' },
        ],
        validate: value => !!value,
        default: 'public'
    }
];
