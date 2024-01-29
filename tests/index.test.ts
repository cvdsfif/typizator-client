import { apiS, bigintS, dateS, objectS, stringS } from "typizator";
import { connectTsApi, API_URL_PARAM } from "../src";

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
            called: { args: [simpleRecordS.notNull], retVal: simpleRecordS.notNull }
        },
        dateFunc: { args: [dateS.notNull, stringS.optional], retVal: dateS.notNull }
    });

    const EXAMPLE_URL = "https://example.api";

    const testApi = connectTsApi(testApiS.metadata, EXAMPLE_URL);

    test("Should correctly translate a call of string=>string function", async () => {
        fetchMock.mockReturnValueOnce(Promise.resolve({ json: async () => ({ data: "Return" }) }));
        expect(await testApi.helloWorld("Test")).toEqual("Return");
        expect(fetchMock).toHaveBeenCalledWith(
            EXAMPLE_URL + "/hello-world",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
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
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
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
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                body: `[{"id":0,"name":""}]`
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
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
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
    });

    test("Should raise an error if there is no data field on server call result", async () => {
        fetchMock.mockReturnValueOnce(Promise.resolve({ json: async () => ({ wrong: "Report" }) }));
        await expect(testApi.helloWorld("Test")).rejects
            .toThrow(`There must be a data field in the received JSON: {"wrong":"Report"}`);
    });
});