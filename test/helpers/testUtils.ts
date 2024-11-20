import { Request, Response } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';

export const mockRequest = <
    P = ParamsDictionary,
    ResBody = any,
    ReqBody = any,
    ReqQuery = ParsedQs,
>(options: {
    body?: ReqBody;
    params?: P;
    query?: ReqQuery;
    headers?: Record<string, string>;
    user?: { accountId: number };
} = {}): Request<P, ResBody, ReqBody, ReqQuery> => {
    const req = {
        body: options.body || {},
        params: options.params || {},
        query: options.query || {},
        headers: options.headers || {},
        user: options.user || { accountId: 1 },
        accepts: jest.fn(),
        acceptsCharsets: jest.fn(),
        acceptsEncodings: jest.fn(),
        acceptsLanguages: jest.fn(),
        accepted: [],
        get: jest.fn(),
        header: jest.fn(),
        is: jest.fn(),
        param: jest.fn(),
        range: jest.fn(),
        secure: false,
        stale: false,
        fresh: false,
        xhr: false,
        cookies: {},
        signedCookies: {},
        route: {},
        originalUrl: '',
        baseUrl: '',
        url: '',
        path: '',
        hostname: '',
        ip: '',
        ips: [],
        subdomains: [],
        method: '',
        protocol: '',
        secret: undefined,
        app: {
            get: jest.fn(),
            set: jest.fn(),
        },

        // Additional required properties
        res: {} as Response,
        next: jest.fn(),

        // Common methods
        logout: jest.fn(),
        login: jest.fn(),
        isAuthenticated: jest.fn(),
        isUnauthenticated: jest.fn(),

        // Socket properties
        socket: {},

        // Express specific
        clearCookie: jest.fn(),
        attachment: jest.fn(),
        download: jest.fn(),
        links: jest.fn(),
        render: jest.fn(),
        vary: jest.fn(),
        type: jest.fn(),
        format: jest.fn(),

        // Event emitter methods
        on: jest.fn(),
        once: jest.fn(),
        emit: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        removeAllListeners: jest.fn(),
        setMaxListeners: jest.fn(),
        getMaxListeners: jest.fn(),
        listeners: jest.fn(),
        rawListeners: jest.fn(),
        listenerCount: jest.fn(),
        prependListener: jest.fn(),
        prependOnceListener: jest.fn(),
        eventNames: jest.fn(),

    } as unknown as Request<P, ResBody, ReqBody, ReqQuery>;

    return req;
};

export const mockResponse = (): Response => {
    const res: Partial<Response> = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        sendStatus: jest.fn().mockReturnThis(),
        cookie: jest.fn().mockReturnThis(),
        clearCookie: jest.fn().mockReturnThis(),
        header: jest.fn().mockReturnThis(),
        locals: {},
        append: jest.fn().mockReturnThis(),
        attachment: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        type: jest.fn().mockReturnThis(),
        links: jest.fn().mockReturnThis(),
        location: jest.fn().mockReturnThis(),
        redirect: jest.fn().mockReturnThis(),
        render: jest.fn().mockReturnThis(),
        vary: jest.fn().mockReturnThis(),
        format: jest.fn().mockReturnThis(),
        sendFile: jest.fn().mockReturnThis(),
        download: jest.fn().mockReturnThis(),
        contentType: jest.fn().mockReturnThis(),
        headersSent: false,
        get: jest.fn(),
    };
    return res as Response;
};

export const mockNext = jest.fn();

// Additional helper types for testing
export interface RegisterRequestBody {
    email: string;
    password: string;
    name?: string;
}

export interface LoginRequestBody {
    email: string;
    password: string;
}

export interface RefreshTokenRequestBody {
    refreshToken: string;
}