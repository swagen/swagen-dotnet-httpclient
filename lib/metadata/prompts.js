module.exports = [
    {
        type: 'checkbox',
        name: 'generate',
        message: 'What do you want to generate?',
        choices: [
            { name: 'Service implementation', value: 'impl', checked: true },
            { name: 'Model classes', value: 'model', checked: true },
            { name: 'Service interfaces', value: 'intf', checked: false }
        ],
        validate: (input, answers) => input.length > 0
    },
    {
        // when: answers => answers.generate.contains()
        type: 'input',
        name: 'servicesns',
        message: 'Services namespace',
        validate: value => !!value
    },
    {
        type: 'input',
        name: 'modelsns',
        message: 'Models namespace',
        validate: value => !!value,
        default: answers => answers.servicesns
    },
    {
        type: 'input',
        name: 'baseUrl',
        message: 'Base URL variable',
        validate: value => !!value
    }
];
