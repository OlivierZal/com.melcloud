export = PairSession;
/**
 * PairSession is returned by {@link Driver#onPair}.
 * @hideconstructor
 */
declare class PairSession {
    /**
     * @callback PairSession.Handler
     * @param {any} data
     * @returns {Promise<any>}
     */
    /**
     * Register a handler for an event.
     * setHandler accepts async functions that can receive and respond to messages from the pair view.
     * @param {string} event
     * @param {PairSession.Handler} handler
     */
    setHandler(event: string, handler: PairSession.Handler): PairSession;
}
declare namespace PairSession {
    type Handler = (data: any) => Promise<any>;
}
