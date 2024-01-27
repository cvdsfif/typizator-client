import { ApiDefinition, ApiImplementation, ApiMetadata } from "typizator";
import JSONBig from "json-bigint";

export const API_URL_PARAM = "ApiUrl";
const camelToKebab = (src: string | String) => src.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`);
const implementApi =
    <T extends ApiDefinition>
        (metadata: ApiMetadata<T>, baseUrl: string):
        ApiImplementation<T> => {
        const apiImplementation = {} as ApiImplementation<T>;
        Array.from(metadata.members).forEach(([key, schema]) => {
            const kebabKey = camelToKebab(key as string);
            if (schema.dataType === "api") (apiImplementation as any)[key] = implementApi(schema, `${baseUrl}/${kebabKey}`);
            else {
                const url = `${baseUrl}/${kebabKey}`;
                (apiImplementation as any)[key] = async (...args: any) => {
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
                    });
                    if (received?.errorMessage) throw new Error(`Server error: ${received.errorMessage}`);
                    if (received?.data === undefined)
                        throw new Error(
                            `There must be a data field in the received JSON: ${JSONBig.stringify(received)}`
                        );
                    return schema.retVal?.unbox(received.data);
                }
            }
        });
        return apiImplementation;
    }

export const connectTsApi =
    <T extends ApiDefinition>
        (metadata: ApiMetadata<T>, cdkExports: any, stackName: string):
        ApiImplementation<T> => implementApi(metadata, cdkExports[stackName][API_URL_PARAM]);