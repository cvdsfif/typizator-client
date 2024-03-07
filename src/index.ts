import { ApiDefinition, ApiImplementation, ApiMetadata } from "typizator";
import JSONBig from "json-bigint";

export const API_URL_PARAM = "ApiUrl";
const camelToKebab = (src: string | String) => src.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`);

const implementApi =
    <T extends ApiDefinition>
        (metadata: ApiMetadata<T>, baseUrl: string,
            freeze: () => void, unfreeze: () => void):
        ApiImplementation<T> => {
        const apiImplementation = {} as ApiImplementation<T>;
        Array.from(metadata.members).forEach(([key, schema]) => {
            const kebabKey = camelToKebab(key as string);
            if (schema.dataType === "api") (apiImplementation as any)[key] =
                implementApi(schema, `${baseUrl}/${kebabKey}`, freeze, unfreeze);
            else {
                const url = baseUrl.endsWith("/") ? `${baseUrl}${kebabKey}` : `${baseUrl}/${kebabKey}`;
                (apiImplementation as any)[key] = async (...args: any) => {
                    freeze?.();
                    const received = await fetch(url, {
                        method: "POST",
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        },
                        body: JSONBig.stringify(args)
                    }).then(
                        r => r.json()
                    ).catch(e => {
                        throw new Error(`Error in fetch: ${e.message}`);
                    }).finally(() => unfreeze?.());
                    if (received?.errorMessage) throw new Error(`Server error: ${received.errorMessage}`);
                    if (!schema.retVal) return undefined
                    if (received?.data === undefined)
                        throw new Error(
                            `There must be a data field in the received JSON: ${JSONBig.stringify(received)}`
                        );
                    if (typeof received.data === "string"
                        && (received.data as string).startsWith(`"`))
                        return schema.retVal?.unbox((received.data as string).substring(1, (received.data as string).length - 1));
                    return schema.retVal?.unbox(received.data);
                }
            }
        });
        return apiImplementation;
    }

export const connectTsApi =
    <T extends ApiDefinition>
        (metadata: ApiMetadata<T>, url: string, freeze = () => { }, unfreeze = () => { }):
        ApiImplementation<T> => implementApi(metadata, url, freeze, unfreeze);