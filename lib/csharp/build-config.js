module.exports = function (options, answers) {
    if (!answers.generate || answers.generate.length === 0) {
        answers.generate = ['impl', 'model', 'shared'];
    }
    options.generate = {
        implementation: answers.generate.some(g => g === 'impl'),
        models: answers.generate.some(g => g === 'model'),
        interfaces: answers.generate.some(g => g === 'intf'),
        clientFactory: answers.generate.some(g => g === 'clientfactory'),
        shared: answers.generate.some(g => g === 'shared')
    };
    options.namespaces = {
        services: answers.servicesns,
        models: answers.modelsns
    };
    options.baseUrl = {
        access: answers.baseUrlAccess
    };
    if (answers.baseUrlAccess === 'ctor') {
        options.baseUrl.parameterName = answers.baseUrl_ctor_paramName;
        options.baseUrl.parameterType = answers.baseUrl_ctor_paramType;
        options.baseUrl.parameterPath = answers.baseUrl_ctor_paramPath;
    } else if (answers.baseUrlAccess === 'global') {
        options.baseUrl.global = answers.baseUrl_global;
    }
    options.additionalNamespaces = answers.additionalNamespaces || [];

    // Other options not from the answers
    options.skipModelsNsPrefix = false;
};
