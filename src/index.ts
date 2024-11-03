import { ApiDefinition, ApiImplementation, ApiMetadata, ApiSchema, FunctionMetadata } from "typizator";
import JSONBig from "json-bigint";

export const API_URL_PARAM = "ApiUrl";
const camelToKebab = (src: string | String) => src.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)

export type SubApiUrls<T extends ApiDefinition> = {
    [K in keyof T as T[K] extends ApiDefinition ? K : never]?:
    T[K] extends ApiDefinition ? Partial<BaseUrlInformation<T[K]>> : never
}
/**
 * Information about the connection to the server HTTP/JSON API
 */
export type BaseUrlInformation<T extends ApiDefinition> = {
    /**
     * Base URL for the API
     */
    url: string,
    /**
     * You usually don't have to use it directly, it is used to track URLs in sub-APIs
     */
    path?: string,
    /**
     * URL information for the child APIs. You can override the URLs for some of them
     */
    children?: SubApiUrls<T>,
    /**
     * Freezer function that is called when the server call is started. Allows to freeze the interface if needed
     */
    freeze?: () => void,
    /**
     * Unfreezer function that is called when the server call is finishied (whatever is the result). Allows to unfreeze the interface if needed
     */
    unfreeze?: () => void,
    /**
     * If true, configure API to ignore CORS restrictions
     */
    wildcardCors?: boolean,
}

const implementApi =
    <T extends ApiDefinition>
        (
            metadata: ApiMetadata<T>,
            connectivity: BaseUrlInformation<T>,
            securityProvider?: () => string
        ): ApiImplementation<T> => {
        const url = connectivity.url.endsWith("/") ? connectivity.url : `${connectivity.url}/`
        const apiImplementation = {} as ApiImplementation<T>
        Object.keys(metadata.implementation).forEach(key => {
            const schema = (metadata.implementation as any)[key].metadata as FunctionMetadata | ApiMetadata<any>
            const kebabKey = camelToKebab(key as string);
            if (schema.dataType === "api") {
                const childConnectivity = (connectivity.children as any)?.[key] as Partial<BaseUrlInformation<any>>;
                (apiImplementation as any)[key] =
                    implementApi(schema, {
                        url: childConnectivity?.url ?? url,
                        path: `${connectivity.path ? `${connectivity.path}/` : ``}${kebabKey}`,
                        children: childConnectivity?.children,
                        freeze: childConnectivity?.freeze ?? connectivity.freeze,
                        unfreeze: childConnectivity?.unfreeze ?? connectivity.unfreeze,
                        wildcardCors: childConnectivity?.wildcardCors ?? connectivity.wildcardCors
                    }, securityProvider)
            }
            else {
                const fullUrl = `${url}${connectivity.path ? `${connectivity.path}/` : ""}${kebabKey}`;
                (apiImplementation as any)[key] = async (...args: any) => {
                    connectivity.freeze?.()
                    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
                    const received = await fetch(fullUrl, {
                        method: "POST",
                        // same-origin is needed for CORS to work
                        credentials: connectivity.wildcardCors ? undefined :
                            (isSafari ? "same-origin" : "include"),
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                            'x-security-token': securityProvider?.() ?? "",
                            'Origin': window.location.origin,
                            'X-Requested-With': 'XMLHttpRequest',
                            'X-Custom-Header': '1',
                            'Authorization': 'Bearer rand'
                        },
                        body: JSONBig.stringify(args)
                    }).then(
                        r =>
                            r.status === 401 ?
                                ({ errorMessage: "Unauthorized" }) :
                                r.json()
                    ).catch(e => {
                        throw new Error(`Error in fetch: ${e.message}`)
                    }).finally(() => connectivity.unfreeze?.())
                    if (received?.errorMessage) throw new Error(`Server error: ${received.errorMessage}`)
                    if (received?.message) throw new Error(`Server error: ${received.message}`)
                    if (!schema.retVal) return undefined
                    if (received?.data === undefined)
                        throw new Error(
                            `There must be a data field in the received JSON: ${JSONBig.stringify(received)}`
                        )
                    if (typeof received.data === "string"
                        && (received.data as string).startsWith(`"`))
                        return schema.retVal?.unbox((received.data as string).substring(1, (received.data as string).length - 1))
                    return schema.retVal?.unbox(received.data)
                }
            }
        })
        return apiImplementation
    }

/**
 * Connects to the server API defined by a typizator API schema
 * @param metadata API schema definition allowing strict typing of parameters and return types of the methods
 * @param connectivity Information on how to connect to the backend server. See `BaseUrlInformation` for details
 * @param securityProvider Optional function returning a security token that will be sent to the server as X-Security-Token header
 * @returns Callable API with every method implemented as `async` function
 */
export const connectTsApi =
    <T extends ApiDefinition>
        (
            metadata: ApiMetadata<T>,
            connectivity: BaseUrlInformation<T>,
            securityProvider?: () => string
        ):
        ApiImplementation<T> => implementApi(metadata, connectivity, securityProvider)