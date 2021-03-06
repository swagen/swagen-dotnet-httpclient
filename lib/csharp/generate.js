'use strict';

const _ = require('lodash');
const codewriter = require('codewriter');
const cs = require('swagen-csharp-language');

class Generator {
    constructor(definition, profile) {
        this.definition = definition;
        this.profile = profile;
        this.profile.prefixLines = this.profile.prefixLines || [];
        this.setupOptions();
        this.cs = new cs.CSharpLanguage(this.profile, this.definition, {
            modelNamespace: this.options.namespaces.models,
            skipModelPrefix: this.options.skipModelsNsPrefix,
            collectionType: 'IList'
        });
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
        if (this.options.generate.interfaces) {
            this.code.blank();
            this.generateInterfaces();
        }
        if (this.options.generate.implementation) {
            this.code.blank();
            this.generateServices();
        }
        if (this.options.generate.models) {
            this.code.blank();
            this.generateModels();
        }
        if (this.options.generate.clientFactory) {
            this.code.blank();
            this.generateClientFactory();
        }
        return this.code.toCode();
    }

    generateInitialCode() {
        this.code
            .repeat(this.profile.prefixLines, (cb, line) => {
                cb.line(line);
            })
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
                `using Newtonsoft.Json.Serialization;`
            )
            .lineIf(!this.options.skipModelsNsPrefix, ``)
            .lineIf(!this.options.skipModelsNsPrefix, `using __models = ${this.profile.options.namespaces.models};`)
            .lineIf(this.options.skipModelsNsPrefix || this.options.additionalNamespaces.length > 0, ``)
            .lineIf(this.options.skipModelsNsPrefix, `using ${this.profile.options.namespaces.models};`)
            .repeat(this.options.additionalNamespaces, (cw, additionalNs) => {
                cw.line(`using ${additionalNs};`);
            });
    }

    generateInterfaces() {
        const serviceNames = _.keys(this.definition.services).sort((x, y) => x.toLowerCase().localeCompare(y.toLowerCase()));

        this.code
            .startBlock(`namespace ${this.options.namespaces.services}`)
                .repeat(serviceNames, (cb, serviceName, i) => {
                    cb.blank(i > 0);
                    this.generateInterface(cb, serviceName);
                })
            .endBlock();
    }

    generateInterface(code, serviceName) {
        const service = this.definition.services[serviceName];

        code.startBlock(`${this.accessLevel} interface I${serviceName}`)
                .iterate(service, (cb, operation, operationName) => {
                    cb.line(`${this.getMethodSignature(operationName, operation)};`);
                })
            .endBlock();
    }

    generateServices() {
        this.code
            .startBlock(`namespace ${this.options.namespaces.services}`)
                .func(cb => this.generateImplementations(cb))
                .blank()
                .func(cb => this.generateGlobalInitializer(cb))
                .blank()
                .func(cb => this.generateExceptionClasses(cb))
            .endBlock(`}`);
    }

    generateImplementations(code) {
        const serviceNames = _.keys(this.definition.services).sort((x, y) => x.toLowerCase().localeCompare(y.toLowerCase()));
        code.repeat(serviceNames, (cb, serviceName) => this.generateImplementation(cb, serviceName));
    }

    generateImplementation(code, serviceName) {
        const service = this.definition.services[serviceName];

        let classDecl = `${this.accessLevel} sealed partial class ${serviceName}`;
        if (this.options.generate.interfaces) {
            classDecl += ` : I${serviceName}`;
        }
        code
            .blank()
            .startBlock(classDecl)
                .line(`private readonly HttpClient _client;`)
                .line(`private readonly JsonSerializerSettings _serializerSettings;`)
                .line(`private Uri _baseUrl = new Uri("${this.baseUrl}", UriKind.Absolute);`)
                .blank()
                .startBlock(`${this.accessLevel} ${serviceName}()`)
                    .line(`_client = new HttpClient();`)
                    .line(`__GlobalInitializer.InitializeClient(_client);`)
                    .line(`__InitializeClient(_client);`)
                    .line(`_serializerSettings = new JsonSerializerSettings();`)
                    .line(`__GlobalInitializer.InitializeJsonSerializer(_serializerSettings);`)
                    .line(`__InitializeJsonSerializer(_serializerSettings);`)
                .endBlock()
                .blank()
                .startBlock(`${this.accessLevel} ${serviceName}(HttpClient client)`)
                    .line(`_client = client;`)
                    .line(`BaseUrl = _client.BaseAddress;`)
                    .line(`__GlobalInitializer.InitializeClient(_client);`)
                    .line(`__InitializeClient(_client);`)
                    .line(`_serializerSettings = new JsonSerializerSettings();`)
                    .line(`__GlobalInitializer.InitializeJsonSerializer(_serializerSettings);`)
                    .line(`__InitializeJsonSerializer(_serializerSettings);`)
                .endBlock()
                .blank()
                .line(`partial void __InitializeClient(HttpClient client);`)
                .line(`partial void __InitializeJsonSerializer(JsonSerializerSettings settings);`)
                .blank()
                .startBlock(`${this.accessLevel} Uri BaseUrl`)
                    .line(`get => _baseUrl;`)
                    .line(`set => _baseUrl = value ?? throw new ArgumentNullException(nameof(value));`)
                .endBlock()
                .iterate(service, (cb, operation, operationName) => this.generateOperation(cb, operation, operationName))
                .blank()
                .func(cb => this.generateBuildServiceUrlMethod(cb))
            .endBlock();
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

        const headerParams = operation.parameters.filter(p => p.type === 'header');
        if (headerParams.length > 0) {
            code.repeat(headerParams, (cb, p) => {
                cb.line(`_request.Headers.Add("${p.name}", ${p.name});`);
            });
        }

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
                const returnDataType = this.cs.getDataType(response.dataType, this.options.skipModelsNsPrefix);
                cb.line(`var _result${scode} = JsonConvert.DeserializeObject<${returnDataType}>(_responseContent, _serializerSettings);`);
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
                return this.cs.getDataType(operation.responses[statusKey].dataType, this.options.skipModelsNsPrefix);
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
            const dataType = this.cs.getDataType(param.dataType, this.options.skipModelsNsPrefix);
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
            .startBlock(`private Uri BuildServiceUrl(string relativeUrl, IDictionary<string, object> queryParams = null)`)
                .line(`relativeUrl = relativeUrl ?? "";`)
                .line(`if (relativeUrl.StartsWith("/"))`)
                    .indent(`relativeUrl = relativeUrl.Substring(1);`)
                .unindent()
                .startBlock(`if (queryParams?.Count > 0)`)
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
                .endBlock()
                .line(`if (!Uri.TryCreate(BaseUrl, relativeUrl, out Uri serviceUrl))`)
                .indent()
                .line(`throw new UriFormatException($"Could not create an absolute URL from base URL '{BaseUrl}' and relative URL '{relativeUrl}'.");`)
                .unindent()
                .line(`return serviceUrl;`)
            .endBlock();
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
            .line(`${this.accessLevel} partial class ${className}`)
            .line(`{`)
            .indent()
            .iterate(model, (cb, property, propertyName) => {
                const propertyType = this.cs.getDataType(property, this.options.skipModelsNsPrefix);
                cb.lineIf(property.isArray, `private ${propertyType} _${propertyName};`)
                    .blank(property.isArray)
                    .line(`[JsonProperty("${propertyName}", Required = Required.Default, NullValueHandling = NullValueHandling.Ignore)]`)
                    .funcIf(property.isArray, cb2 => this.generateArrayProperty(cb2, propertyType, propertyName), propertyType, propertyName)
                    .lineIf(!property.isArray, `public ${propertyType} ${propertyName} { get; set; }`)
                    .blank();
            })
            .unindent(`}`);
    }

    /**
     * @param {codewriter.CodeWriter} code
     * @param {string} propertyType
     * @param {string} propertyName
     */
    generateArrayProperty(code, propertyType, propertyName) {
        code.startBlock(`public ${propertyType} ${propertyName}`)
                .line(`get => _${propertyName} ?? (_${propertyName} = new ${propertyType.substr(1)}());`)
                .line(`set => _${propertyName} = value;`)
            .endBlock();
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

    generateClientFactory() {
    }
}

module.exports = (definition, profile) => {
    const generator = new Generator(definition, profile);
    return generator.generate();
};

