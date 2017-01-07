module.exports = function(options, answers, generalAnswers) {
    options.namespaces = {
        services: answers.servicesns,
        models: answers.modelsns
    };
    options.baseUrl = answers.baseUrl;
};
