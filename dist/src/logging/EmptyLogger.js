"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmptyLogger = void 0;
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * @description Used for testing only to omit console logs.
 */
class EmptyLogger {
    debug(msg, data) {
    }
    error(msg, data) {
    }
    info(msg, data) {
    }
    warn(msg, data) {
    }
}
exports.EmptyLogger = EmptyLogger;
//# sourceMappingURL=EmptyLogger.js.map