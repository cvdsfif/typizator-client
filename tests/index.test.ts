import { apiS, bigintS, dateS, objectS, stringS } from "typizator";
import { connectTsApi } from "../src";

describe("Testing Typescript API connection on a fetch mock", () => {
    const fetchMock: jest.Mock = global.fetch = jest.fn();

    beforeEach(() => fetchMock.mockClear());

    const simpleRecordS = objectS({
        id: bigintS,
        name: stringS
    });
    const testApiS = apiS({
        helloWorld: { args: [stringS.notNull], retVal: stringS.notNull },
        noArgs: { args: [] },
        group: {
            called: { args: [simpleRecordS.notNull], retVal: simpleRecordS.notNull },
            secondLevel: {
                foo: { args: [] }
            }
        },
        dateFunc: { args: [dateS.notNull, stringS.optional], retVal: dateS.notNull }
    });

    const EXAMPLE_URL = "https://example.api";

    const testApi = connectTsApi(testApiS.metadata, { url: EXAMPLE_URL })

    test("Should correctly translate a call of string=>string function", async () => {
        fetchMock.mockReturnValueOnce(Promise.resolve({ json: async () => ({ data: "Return" }) }));
        expect(await testApi.helloWorld("Test")).toEqual("Return");
        expect(fetchMock).toHaveBeenCalledWith(
            EXAMPLE_URL + "/hello-world",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", 'x-security-token': "" },
                body: `["Test"]`
            }
        );
    });

    test("Should not add extra trailing slash in URL address", async () => {
        const EXAMPLE_URL_WITH_SLASH = "https://example.api/";
        const testApiWithSlash = connectTsApi(testApiS.metadata, { url: EXAMPLE_URL_WITH_SLASH });
        fetchMock.mockReturnValueOnce(Promise.resolve({ json: async () => ({ data: "Return" }) }));
        await testApiWithSlash.helloWorld("Test");
        expect(fetchMock).toHaveBeenCalledWith(
            EXAMPLE_URL_WITH_SLASH + "hello-world",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", 'x-security-token': "" },
                body: `["Test"]`
            }
        );
    });

    test("Should correctly translate a call of string=>string function returning quoted string", async () => {
        fetchMock.mockReturnValueOnce(Promise.resolve({ json: async () => ({ data: `"Return"` }) }));
        expect(await testApi.helloWorld("Test")).toEqual("Return");
    });

    test("Should correctly translate a call of void=>void function", async () => {
        fetchMock.mockReturnValueOnce(Promise.resolve({ json: async () => ({ data: "" }) }));
        expect(await testApi.noArgs()).toBeUndefined();
        expect(fetchMock).toHaveBeenCalledWith(
            EXAMPLE_URL + "/no-args",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", 'x-security-token': "" },
                body: `[]`
            }
        );
    });

    test("Should correctly translate a call of object=>object function in a sub-api", async () => {
        fetchMock.mockReturnValueOnce(Promise.resolve({ json: async () => ({ data: `{"id":12345678901234567890,"name":"some"}` }) }));
        expect(await testApi.group.called({ id: 0n, name: "" })).toEqual({ id: 12345678901234567890n, name: "some" });
        expect(fetchMock).toHaveBeenCalledWith(
            EXAMPLE_URL + "/group/called",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", 'x-security-token': "" },
                body: `[{"id":0,"name":""}]`
            }
        )
    })

    test("Should correctly translate a call of object=>object function in a sub-api with a different base URL", async () => {
        const URL_CHANGED = "http://glop"
        const testApiChanged = connectTsApi(testApiS.metadata, {
            url: EXAMPLE_URL,
            children: {
                group: {
                    url: URL_CHANGED
                }
            }
        })
        fetchMock.mockReturnValueOnce(Promise.resolve({ json: async () => ({ data: `{"id":12345678901234567890,"name":"some"}` }) }))
        expect(await testApiChanged.group.called({ id: 0n, name: "" })).toEqual({ id: 12345678901234567890n, name: "some" })
        expect(fetchMock).toHaveBeenCalledWith(
            URL_CHANGED + "/group/called",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", 'x-security-token': "" },
                body: `[{"id":0,"name":""}]`
            }
        )
    })

    test("Should correctly translate a call of empty function in a sub-sub-api", async () => {
        fetchMock.mockReturnValueOnce(Promise.resolve({ json: async () => ({}) }));
        expect(await testApi.group.secondLevel.foo()).toBeUndefined();
        expect(fetchMock).toHaveBeenCalledWith(
            EXAMPLE_URL + "/group/second-level/foo",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", 'x-security-token': "" },
                body: `[]`
            }
        );
    });

    test("Should correctly translate a call of date=>date function", async () => {
        fetchMock.mockReturnValueOnce(Promise.resolve({ json: async () => ({ data: "2024-01-01 12:00Z" }) }));
        expect((await testApi.dateFunc(new Date("2024-01-26"), undefined)).toUTCString())
            .toEqual(new Date("2024-01-01 12:00Z").toUTCString());
        expect(fetchMock).toHaveBeenCalledWith(
            EXAMPLE_URL + "/date-func",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", 'x-security-token': "" },
                body: `["2024-01-26T00:00:00.000Z",null]`
            }
        );
    });

    test("Should raise an error if there is a connection problem", async () => {
        fetchMock.mockImplementationOnce(async () => { throw new Error("Alert") });
        await expect(testApi.helloWorld("Test")).rejects.toThrow("Error in fetch: Alert");
    });

    test("Should raise an error if there is a reported server error", async () => {
        fetchMock.mockReturnValueOnce(Promise.resolve({ json: async () => ({ errorMessage: "Report" }) }));
        await expect(testApi.helloWorld("Test")).rejects.toThrow("Server error: Report");
    })

    test("Should raise an error if there is no data field on server call result", async () => {
        fetchMock.mockReturnValueOnce(Promise.resolve({ json: async () => ({ wrong: "Report" }) }));
        await expect(testApi.helloWorld("Test")).rejects
            .toThrow(`There must be a data field in the received JSON: {"wrong":"Report"}`);
    })

    test("Should not raise an error on no data field on server call result if the return value is absent", async () => {
        fetchMock.mockReturnValueOnce(Promise.resolve({ json: async () => ({}) }));
        expect(await testApi.noArgs()).toBeUndefined()
    })

    test("Should call the provided freeze and unfreeze if needed", async () => {
        fetchMock.mockReturnValueOnce(Promise.resolve({ json: async () => ({ data: "" }) }));
        const freeze = jest.fn();
        const unfreeze = jest.fn();
        const freezableApi = connectTsApi(testApiS.metadata, { url: EXAMPLE_URL, freeze, unfreeze });
        await freezableApi.noArgs();
        expect(freeze).toHaveBeenCalled();
        expect(unfreeze).toHaveBeenCalled();
    })

    test("Should forward the security token to the server API", async () => {
        // GIVEN the API is configured to use the security context
        const SECURITY_TOKEN = "Toktok"
        const testApi = connectTsApi(testApiS.metadata, { url: EXAMPLE_URL }, () => SECURITY_TOKEN)
        fetchMock.mockReturnValueOnce(Promise.resolve({ json: async () => ({ data: "Return" }) }))

        // WHEN calling the client function
        expect(await testApi.helloWorld("Test")).toEqual("Return");

        // THEN the security context is sent to the server API
        expect(fetchMock).toHaveBeenCalledWith(
            EXAMPLE_URL + "/hello-world",
            {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    'x-security-token': SECURITY_TOKEN
                },
                body: `["Test"]`
            }
        );
    })
})