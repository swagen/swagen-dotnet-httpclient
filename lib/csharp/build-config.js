module.exports = function(options, answers) {
    options.namespaces = {
        services: answers.servicesns,
        models: answers.modelsns
    };
    options.accessLevel = answers.accessLevel;
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
};
