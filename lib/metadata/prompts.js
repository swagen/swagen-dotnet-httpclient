module.exports = [
    {
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
