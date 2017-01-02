module.exports = [
    {
        name: 'csharp',
        description: 'Generates C# code',
        language: 'C#',
        extension: 'cs',
        prompts: require('./prompts'),
        configBuilderFn: require('./config-builder')
    }
];
