module.exports = function(cb, answers, generalAnswers) {
    cb
        .line(`namespaces: {`)
            .indent(`services: '${answers.servicesns}',`)
            .line(`models: '${answers.modelsns}'`)
        .unindent(`},`)
        .line(`baseUrl: '${answers.baseUrl}'`)
};
