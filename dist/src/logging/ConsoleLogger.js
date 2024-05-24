"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleLogger = void 0;
class ConsoleLogger {
    debug(msg, data) {
        if (data) {
            console.debug(msg, data);
        }
        else {
            console.debug(msg);
        }
    }
    error(msg, data) {
        if (data) {
            console.error(msg, data);
        }
        else {
            console.error(msg);
        }
    }
    info(msg, data) {
        if (data) {
            console.log(msg, data);
        }
        else {
            console.log(msg);
        }
    }
    warn(msg, data) {
        if (data) {
            console.warn(msg, data);
        }
        else {
            console.warn(msg);
        }
    }
}
exports.ConsoleLogger = ConsoleLogger;
//# sourceMappingURL=ConsoleLogger.js.map