'use strict';

const _ = require('lodash');
const codewriter = require('codewriter');
const cs = require('swagen-csharp-language');

const getDataType = require('./get-data-type');

class Generator {
    constructor(definition, profile) {
        this.definition = definition;
        this.profile = profile;
        this.setupOptions();
        this.cs = new cs.CSharpLanguage(this.profile, this.definition, this.options);
    }

    setupOptions() {
        this.options = this.profile.options || {};
        this.baseUrl = this.options.baseUrlOverride || this.definition.metadata.baseUrl;
        this.accessLevel = this.options.accessLevel || 'public';
    }

    generate() {
        const options = codewriter.OptionsLibrary.csharp;
        this.code = new codewriter.CodeWriter(options);
        this.generateInitialCode();
        this.code.blank();
        this.generateServices();
        if (this.options.generate.models) {
            this.code.blank();
            this.generateModels();
        }
        return this.code.toCode();
    }

    generateInitialCode() {
        this.code
            .line(...this.cs.buildHeader())
            .blank()
            .line(
                `using System;`,
                `using System.Collections.Generic;`,
                `using System.Linq;`,
                `using System.Net.Http;`,
                `using System.Net.Http.Headers;`,
                `using System.Text;`,
                `using System.Threading.Tasks;`,
                ``,
                `using Newtonsoft.Json;`,
                `using Newtonsoft.Json.Serialization;`,
                ``,
                `using __models = ${this.profile.options.namespaces.models};`
            )
            .repeat(this.options.additionalNamespaces, (cw, additionalNs) => {
                cw.line(`using ${additionalNs};`);
            });
    }

    generateServices() {
        this.code
            .line(`namespace ${this.options.namespaces.services}`)
            .line(`{`)
            .indent()
                .func(cb => this.generateImplementations(cb))
                .blank()
                .func(cb => this.generateGlobalInitializer(cb))
                .blank()
                .func(cb => this.generateExceptionClasses(cb))
            .unindent(`}`);
}

    generateImplementations(code) {
        const serviceNames = _.keys(this.definition.services).sort((x, y) => x.toLowerCase().localeCompare(y.toLowerCase()));
        code.repeat(serviceNames, (cb, serviceName) => this.generateImplementation(cb, serviceName));
    }

    generateImplementation(code, serviceName) {
        const service = this.definition.services[serviceName];

        const className = serviceName + (this.options.serviceSuffix || '');
        code
            .blank()
            .line(`${this.accessLevel} sealed partial class ${className}`)
            .line(`{`)
            .indent()
                .line(`private readonly HttpClient _client;`)
                .line(`private readonly JsonSerializerSettings _serializerSettings;`)
                .line(`private Uri _baseUrl = new Uri("${this.baseUrl}", UriKind.Absolute);`)
                .blank()
                .line(`${this.accessLevel} ${className}()`)
                .line(`{`)
                .indent()
                    .line(`_client = new HttpClient();`)
                    .line(`__GlobalInitializer.InitializeClient(_client);`)
                    .line(`__InitializeClient(_client);`)
                    .line(`_serializerSettings = new JsonSerializerSettings();`)
                    .line(`__GlobalInitializer.InitializeJsonSerializer(_serializerSettings);`)
                    .line(`__InitializeJsonSerializer(_serializerSettings);`)
                .unindent(`}`)
                .blank()
                .line(`partial void __InitializeClient(HttpClient client);`)
                .line(`partial void __InitializeJsonSerializer(JsonSerializerSettings settings);`)
                .blank()
                .line(`${this.accessLevel} Uri BaseUrl`)
                .line(`{`)
                .indent()
                    .line(`get => _baseUrl;`)
                    .line(`set => _baseUrl = value ?? throw new ArgumentNullException(nameof(value));`)
                .unindent(`}`)
                .iterate(service, (cb, operation, operationName) => this.generateOperation(cb, operation, operationName))
                .blank()
                .func(cb => this.generateBuildServiceUrlMethod(cb))
            .unindent(`}`);
    }

    generateOperation(code, operation, operationName) {
        code.blank()
            .line(`${this.accessLevel} async ${this.getMethodSignature(operationName, operation)}`)
            .line(`{`)
            .indent();

        // Check required parameters
        const requiredParams = operation.parameters.filter(p => !!p.required);
        requiredParams.forEach(p => {
            code.line(`if (${p.name} == null)`)
                .indent()
                    .line(`throw new ArgumentNullException(nameof(${p.name}));`)
                .unindent();
        });
        code.blank(requiredParams.length > 0);

        // Resolve path parameters in relative URL
        const pathParams = operation.parameters.filter(p => p.type === 'path');
        const hasPathParams = pathParams.length > 0;
        code.inline(`string _resourceUrl = "${operation.path}"`)
            .inline(`;`, !hasPathParams)
            .done();
        if (hasPathParams) {
            code.indent()
                .repeat(pathParams, (cb, p, idx) => {
                    cb.inline(`.Replace("{${p.name}}", Uri.EscapeUriString(${p.name}?.ToString()))`)
                        .inline(`;`, idx === pathParams.length - 1)
                        .done();
                })
                .unindent();
        }
        code.blank();

        // Build dictionary for query strings
        const queryParams = operation.parameters.filter(p => p.type === 'query');
        const hasQueryParams = queryParams.length > 0;
        if (hasQueryParams) {
            code.line(`var _queryParams = new Dictionary<string, object>`)
                .line(`{`)
                .indent()
                    .repeat(queryParams, (cb, p) => {
                        cb.line(`["${p.name}"] = ${p.name},`);
                    })
                .unindent(`};`)
                .blank();
        }

        code.inline(`Uri _serviceUrl = BuildServiceUrl(_resourceUrl`)
                .inline(`, _queryParams`, hasQueryParams)
                .inline(`);`)
                .done()
            .blank();

        const bodyParam = operation.parameters.find(p => p.type === 'body');
        const verb = _.upperFirst(_.camelCase(operation.verb));
        // const returnType = this.getReturnType(operation);

        code.line(`using (var _request = new HttpRequestMessage(HttpMethod.${verb}, _serviceUrl))`)
            .line(`{`)
            .indent();

        if (bodyParam) {
            code.line(`var _content = new StringContent(JsonConvert.SerializeObject(${bodyParam.name}, _serializerSettings));`)
                .line(`_content.Headers.ContentType.MediaType = "application/json";`)
                .line(`_request.Content = _content;`);
        }
        code.line(`_request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));`);

        code.blank()
            .line(`HttpResponseMessage _response = await _client.SendAsync(_request).ConfigureAwait(false);`)
            .blank();

        code.line(`int _statusCode = (int)_response.StatusCode;`)
            .line(`string _responseContent = await _response.Content.ReadAsStringAsync().ConfigureAwait(false);`)
            .line(`switch (_statusCode)`)
            .line(`{`)
            .indent();

        code.iterate(operation.responses, (cb, response, scode) => {
            const statusCode = +scode;
            const returnsData = !!response.dataType;
            const description = response.description || 'A server side error occurred.';
            cb.line(`case ${scode}:`)
                .indent();
            if (returnsData) {
                const returnDataType = getDataType(response.dataType, undefined, this.options.skipModelsNsPrefix);
                cb.line(`var _result${scode} = JsonConvert.DeserializeObject<${returnDataType}>(_responseContent);`);
                if (statusCode >= 200 && statusCode < 300) {
                    cb.line(`return _result${scode};`);
                } else {
                    cb.line(`throw new WebApiClientException<${returnDataType}>("${description}", _statusCode, _responseContent, _result${scode});`);
                }
            } else {
                cb.line(`throw new WebApiClientException("${description}", _statusCode, _responseContent);`);
            }
            cb.unindent(); // case
        });

        code.line(`default:`)
            .indent()
                .line(`throw new WebApiClientException($"Unexpected status code {_statusCode} was returned from {_serviceUrl}", _statusCode, _responseContent);`)
            .unindent();

        code.unindent(`}`); // switch

        code.unindent(`}`); // using (_request)

        code.unindent(`}`); // method
    }

    getReturnType(operation) {
        if (!operation.responses) {
            return undefined;
        }

        for (const statusKey in operation.responses) {
            const statusCode = +statusKey;
            if (statusCode >= 200 && statusCode < 300 && operation.responses[statusKey].dataType) {
                return getDataType(operation.responses[statusKey].dataType, undefined, this.options.skipModelsNsPrefix);
            }
        }

        return undefined;
    }

    getMethodSignature(operationName, operation) {
        // Order the parameters, with required parameters first
        const orderedParams = operation.parameters.filter(p => p.required).concat(
            operation.parameters.filter(p => !p.required)
        );

        // Build a parameter string from the ordered parameters
        const parameters = orderedParams.reduce((accumulate, param) => {
            if (accumulate) {
                accumulate += ', ';
            }
            const dataType = getDataType(param.dataType, param.name, this.options.skipModelsNsPrefix);
            accumulate += `${dataType} ${param.name}`;
            if (!param.required) {
                accumulate += ` = default(${dataType})`;
            }
            return accumulate;
        }, '');

        const returnType = this.getReturnType(operation);
        const taskReturnType = returnType ? `Task<${returnType}>` : 'Task';

        return `${taskReturnType} ${operationName}(${parameters})`;
    }

    generateBuildServiceUrlMethod(code) {
        code
            .line(`private Uri BuildServiceUrl(string relativeUrl, IDictionary<string, object> queryParams = null)`)
            .line(`{`)
            .indent()
                .line(`relativeUrl = relativeUrl ?? "";`)
                .line(`if (queryParams?.Count > 0)`)
                .line(`{`)
                .indent()
                    .line(`string queryString = queryParams.Aggregate(new StringBuilder(), (aggregate, kvp) =>`)
                    .line(`{`)
                    .indent()
                        .line(`aggregate.Append(aggregate.Length == 0 ? "?" : "&")`)
                        .indent()
                            .line(`.Append(Uri.EscapeUriString(kvp.Key));`)
                        .unindent()
                        .line(`if (kvp.Value != null)`)
                        .indent()
                            .line(`aggregate.Append("=").Append(Uri.EscapeUriString(kvp.Value.ToString()));`)
                        .unindent()
                        .line(`return aggregate;`)
                    .unindent()
                    .line(`}).ToString();`)
                    .line(`relativeUrl += queryString;`)
                .unindent(`}`)
                .line(`if (!Uri.TryCreate(BaseUrl, relativeUrl, out Uri serviceUrl))`)
                .indent()
                    .line(`throw new UriFormatException($"Could not create an absolute URL from base URL '{BaseUrl}' and relative URL '{relativeUrl}'.");`)
                .unindent()
                .line(`return serviceUrl;`)
            .unindent(`}`);
    }

    generateGlobalInitializer(code) {
        code
            .line(`public static partial class __GlobalInitializer`)
            .line(`{`)
            .indent()
                .line(`public static void InitializeClient(HttpClient client)`)
                .line(`{`)
                .indent()
                    .line(`DoInitializeClient(client);`)
                .unindent(`}`)
                .blank()
                .line(`static partial void DoInitializeClient(HttpClient client);`)
                .blank()
                .line(`public static void InitializeJsonSerializer(JsonSerializerSettings settings)`)
                .line(`{`)
                .indent()
                    .line(`DoInitializeJsonSerializer(settings);`)
                .unindent(`}`)
                .blank()
                .line(`static partial void DoInitializeJsonSerializer(JsonSerializerSettings settings);`)
            .unindent(`}`);
    }

    generateExceptionClasses(code) {
        code
            .line(`public class WebApiClientException : Exception`)
            .line(`{`)
            .indent()
                .line(`public WebApiClientException(string message, int statusCode, string response) : base(message)`)
                .line(`{`)
                .indent()
                    .line(`StatusCode = statusCode;`)
                    .line(`Response = response;`)
                .unindent(`}`)
                .blank()
                .line(`public int StatusCode { get; }`)
                .blank()
                .line(`public string Response { get; }`)
            .unindent(`}`)
            .blank()
            .line(`public sealed class WebApiClientException<TResult> : WebApiClientException`)
            .line(`{`)
            .indent()
                .line(`public WebApiClientException(string message, int statusCode, string response, TResult result) : base(message, statusCode, response)`)
                .line(`{`)
                .indent()
                    .line(`Result = result;`)
                .unindent(`}`)
                .blank()
                .line(`public TResult Result { get; }`)
            .unindent(`}`);
    }

    generateModels() {
        const modelNames = _.keys(this.definition.models).sort((x, y) => x.toLowerCase().localeCompare(y.toLowerCase()));
        const enumNames = _.keys(this.definition.enums).sort((x, y) => x.toLowerCase().localeCompare(y.toLowerCase()));

        this.code
            .line(`namespace ${this.profile.options.namespaces.models}`)
            .line(`{`)
            .indent()
                .repeat(modelNames, (cb, modelName) => this.generateModel(cb, modelName))
                .blank()
                .repeat(enumNames, (cb, enumName) => this.generateEnum(cb, enumName))
            .unindent(`}`);
    }

    generateModel(code, modelName) {
        const model = this.definition.models[modelName];
        const className = modelName + (this.options.modelSuffix || '');

        code.line(`[JsonObject(MemberSerialization.OptIn)]`)
            .line(`${this.accessLevel} sealed partial class ${className}`)
            .line(`{`)
            .indent()
                .iterate(model, (cb, property, propertyName) => {
                    cb.line(`[JsonProperty("${propertyName}", Required = Required.Default, NullValueHandling = NullValueHandling.Ignore)]`)
                        .line(`public ${getDataType(property, propertyName, this.options.skipModelsNsPrefix)} ${propertyName};`)
                        .blank();
                })
            .unindent(`}`);
    }

    generateEnum(code, enumName) {
        const enumValues = this.definition.enums[enumName];

        code.line(`${this.accessLevel} enum ${enumName}`)
            .line(`{`)
            .indent()
                .repeat(enumValues, (cb, enumValue) => {
                    cb.inline(enumValue).inline(`,`).done();
                })
            .unindent(`}`);
    }
}

module.exports = (definition, profile) => {
    const generator = new Generator(definition, profile);
    return generator.generate();
};

