/**
 * Options for Angular 2+ generators.
 */
export interface AngularTypescriptOptions {
    generation?: {
        generateInterfaces?: boolean;
        generateImplementations?: boolean;
    };

    baseUrl?: {
        strategy?: 'ImportedVar'|'Property'|'InjectedToken'|'Swagger';
        overrideUrl?: string;
        importVar?: {
            importFrom: string;
            importVariable: string;
            property?: string;
        };
        property?: string;
    };

    angular?: {
        httpFramework?: 'HttpClient'|'Http';
        tokenType?: 'InjectedToken'|'OpaqueToken';
        futuresType?: 'Observables'|'Promises';
    };

    customizations?: {
        importFrom: string;
        importVariable: string;
    };
}
