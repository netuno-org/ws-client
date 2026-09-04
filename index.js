import extend from 'just-extend';

const connected = {
  'default': false
};
const closed = {
  'default': true
};

const config = {
  'default': {
    url: null,
    servicesPrefix: '/services',
    method: 'GET',
    connect: () => { },
    close: () => { },
    error: () => { },
    message: () => { },
    autoReconnect: true
  }
};

const webSocket = {};

const servicesListeners = {};

const timeoutAutoReconnect = {};

const ensureServicePrefix = (key, service) => {
    if (service.startsWith(config[key].servicesPrefix)) {
        return service;
    }
    if (config[key].servicesPrefix.endsWith('/') && service.startsWith('/')) {
        service = service.substring(1);
    } else if (!config[key].servicesPrefix.endsWith('/') && !service.startsWith('/')) {
        service = '/'+ service;
    }
    return config[key].servicesPrefix + service;
};

const getServiceListeners = (key, service) => {
    if (typeof(servicesListeners[key]) == 'undefined') {
        servicesListeners[key] = {};
    }
    if (typeof(servicesListeners[key][service]) == "undefined") {
        servicesListeners[key][service] = {counter: 0};
    }
    return servicesListeners[key][service];
};

const _ws = (keyOrArgs, args) => {
    _ws.connect(keyOrArgs, args);
};

_ws.config = (keyOrSettings = 'default', settings) => {
    let key = keyOrSettings;
    if (!settings && keyOrSettings && typeof keyOrSettings === 'object') {
        settings = keyOrSettings;
        key = 'default';
    }
    if (!!settings) {
        if (!config[key]) {
            const newConfig = {};
            extend(true, newConfig, config);
            config[key] = newConfig;
        }
        extend(true, config[key], settings);
    }
    const newConfig = {};
    extend(true, newConfig, config[key]);
    return newConfig;
};

_ws.isConnected = (key = 'default')=> {
    return connected[key];
};

/**
 * Connect to the WebSocket service.
 * @param {string|object} [keyOrArgs='default'] - Configuration key, or an arguments object for the default connection.
 * @param {object} [args] - Arguments to merge into the connection configuration when the first argument is a key.
 */
_ws.connect = (keyOrArgs = 'default', args)=> {
    let key = keyOrArgs;
    if (!args && keyOrArgs && typeof keyOrArgs === 'object') {
      args = keyOrArgs;
      key = 'default';
    }
    if (timeoutAutoReconnect[key] != null) {
        window.clearTimeout(timeoutAutoReconnect[key]);
        timeoutAutoReconnect[key] = null;
    }
    closed[key] = false;
    const settings = {};
    extend(true, settings, config[key]);
    extend(true, settings, args);
    if (webSocket[key] != null && connected[key]) {
        webSocket[key].close();
    }
    let { url } = settings;
    if (url && url.indexOf('/') === 0) {
        let protocol = 'ws:';
        if (window.location.protocol === 'https:') {
            protocol = 'wss:';
        }
        let frontendServer = false;
        let hostname = '';
        let port = '';
        if (window.location.host.indexOf(':') !== -1) {
            hostname = window.location.host.substring(0, window.location.host.indexOf(':'));
            port = window.location.host.substring(window.location.host.indexOf(':') + 1);
        }
        if (port === '3000') {
            frontendServer = true;
            port = '9000';
        }
        if (port.length > 2 && port.substring(port.length - 2, port.length) === '30') {
            frontendServer = true;
            port = port.substring(0, port.length - 2) + '90';
        }
        if (frontendServer) {
            url = `${protocol}//${hostname}:${port}${url}`;
        } else {
            url = `${protocol}//${window.location.host}${url}`;
        }
    }
    webSocket[key] = new WebSocket(url);
    webSocket[key].onopen = (event) => {
        if (timeoutAutoReconnect[key] != null) {
            window.clearTimeout(timeoutAutoReconnect[key]);
            timeoutAutoReconnect[key] = null;
        }
        connected[key] = true;
        settings.connect(event, key);
    };
    webSocket[key].onclose = (event) => {
        connected[key] = false;
        settings.close(event, key);
        if (settings.autoReconnect && closed[key] === false) {
            if (timeoutAutoReconnect[key] != null) {
                window.clearTimeout(timeoutAutoReconnect[key]);
                timeoutAutoReconnect[key] = null;
            }
            timeoutAutoReconnect[key] = window.setTimeout(()=> { _ws.connect(key, settings); }, 1000);
        }
    };
    webSocket[key].onerror = (error) => {
        if (timeoutAutoReconnect[key] != null) {
            window.clearTimeout(timeoutAutoReconnect[key]);
            timeoutAutoReconnect[key] = null;
        }
        connected[key] = false;
        settings.error(error, key);
        webSocket[key].close();
    };
    webSocket[key].onmessage = (event) => {
        let data = event.data;
        try {
            data = JSON.parse(event.data);
        } catch { }
        settings.message(data, event, key);
        if (typeof(data.service) == "string") {
            const service = ensureServicePrefix(key, data.service);
            const listeners = getServiceListeners(key, service);
            Object.values(listeners).forEach((listener) => {
                if (typeof listener !== 'object') {
                    return;
                }
                if (typeof(listener.method) !== "string"
                    || listener.method.toUpperCase() === data.method.toUpperCase()) {
                    if (listener.success && data.status >= 200 && data.status <= 299) {
                        listener.success(data, event);
                    } else if (listener.fail) {
                        listener.fail(data, event);
                    }
                }
                if (listener.end) {
                    listener.end();
                }
            });
        }
    };
};

/**
 * Close the WebSocket connection.
 * @param {string} key - Configuration key (default is 'default').
 */
_ws.close = (key = 'default') => {
    if (timeoutAutoReconnect[key] != null) {
        window.clearTimeout(timeoutAutoReconnect[key]);
        timeoutAutoReconnect[key] = null;
    }
    closed[key] = true;
    if (connected[key]) {
        webSocket[key].close();
    }
};

/**
 * Send a simple message through the WebSocket.
 * Call as `send(message)` where message is an object, or as `send(key, message)` to target a
 * named connection. A bare string first argument is treated as the connection key, not the
 * message, so to send a plain text message pass it as the second argument (`send(key, 'text')`)
 * or wrap it in an object (`send({ content: 'text' })`).
 * @param {string|object} keyOrArgs - Connection key (string), or the message object for the default connection.
 * @param {object|string} [args] - The message to send when the first argument is a connection key: an object, or a string sent as text.
 */
_ws.send = (keyOrArgs = 'default', args)=> {
    let key = keyOrArgs;
    if (!args && keyOrArgs && typeof keyOrArgs === 'object') {
      args = keyOrArgs;
      key = 'default';
    }
    let message = {};
    if (typeof(args) === "string") {
        message.type = 'text';
        message.content = args;
    } else {
        message = args;
        if (typeof(message.content) == "string") {
            message.type = "text";
        } else if (typeof(message.content) == "undefined") {
            message.type = "text";
            message.content = "";
        } else {
            message.type = "json";
        }
    }
    if (connected[key]) {
        webSocket[key].send(JSON.stringify(message));
    }
};

/**
 * Send data to a specific service and optionally listen for the response.
 * @param {string|object} keyOrArgs - Optional configuration key or arguments (service parameters).
 * @param {object} args - The service parameters, including 'service', 'method', 'data', and event callbacks ('start', 'success', 'fail', 'end').
 */
_ws.sendService = (keyOrArgs = 'default', args)=> {
    let key = keyOrArgs;
    if (!args && keyOrArgs && typeof keyOrArgs === 'object') {
        args = keyOrArgs;
        key = 'default';
    }
    let message = {};
    if (typeof(args) === "string") {
        message.type = 'text';
        message.content = args;
    } else {
        message = args;
        if (typeof(message.content) == "string") {
            message.type = "text";
        } else if (typeof(message.content) == "undefined") {
            message.type = "text";
            message.content = "";
        } else {
            message.type = "json";
        }
    }
    if (typeof(message.service) == "string") {
        if (typeof(message.method) == "string") {
            message.method = message.method.toUpperCase();
        }
        if (typeof(message.method) == "undefined") {
            message.method = "GET";
        }
        message.service = ensureServicePrefix(key, message.service);
    }
    if (args.start) {
        args.start();
    }
    if (args.success || args.fail) {
        (() => {
            const listener = {};
            listener.ref = _ws.addListener(key, {
                method: args.method,
                service: args.service,
                start: args.start,
                success: args.success,
                fail: args.fail,
                end: ()=> {
                    console.warn("WS Send Service has Listener Removed: "+ listener.ref);
                    _ws.removeListener(listener.ref);
                    if (args.end) {
                        args.end();
                    }
                }
            });
        })();
    }
    if (connected[key]) {
        const service = ensureServicePrefix(key, args.service);
        const listeners = getServiceListeners(key, service);
        Object.values(listeners).forEach((listener) => {
            if (typeof listener !== 'object') {
                return;
            }
            if (listener.start) {
                listener.start();
            }
        });
        webSocket[key].send(JSON.stringify(message));
    }
};

/**
 * Add a listener for a specific service.
 * @param {string|object} keyOrData - Optional configuration key or listener data.
 * @param {object} data - Listener data including 'service', 'method', 'start', 'success', 'fail', 'end'.
 * @returns {string} The listener reference string.
 */
_ws.addListener = (keyOrData = 'default', data) => {
    let key = keyOrData;
    if (!data && keyOrData && typeof keyOrData === 'object') {
        data = keyOrData;
        key = 'default';
    }
    const service = ensureServicePrefix(key, data.service);
    const listeners = getServiceListeners(key, service);
    const id = listeners.counter++;
    listeners[id] = data;
    return key +'~|~'+ service +'~|~'+ id;
};

/**
 * Remove a previously added listener.
 * @param {string} ref - The listener reference string returned by addListener.
 */
_ws.removeListener = (ref) => {
    const refParts = ref.split('~|~');
    const key = refParts[0];
    const service = refParts[1];
    const id = refParts[2];
    delete getServiceListeners(key, service)[id];
};

/**
 * Get all registered listeners.
 * @param {string} key - Configuration key (default is 'default').
 * @param {string} service - Optional service name to filter by.
 * @returns {object|null} The registered listeners.
 */
_ws.getAllListeners = (key = 'default', service) => {
    if (servicesListeners[key]) {
        if (!service) {
            const listeners = {};
            for (const s of Object.keys(servicesListeners[key])) {
                const sListeners = {...getServiceListeners(key, s)};
                delete sListeners.counter;
                listeners[s] = sListeners;
            }
            return listeners;
        }
        service = ensureServicePrefix(key, service);
        if (servicesListeners[key][service]) {
            const listeners = {...getServiceListeners(key, service)};
            delete listeners.counter;
            return listeners;
        }
    }
    return null;
};

/**
 * Remove all registered listeners.
 * @param {string} key - Configuration key (default is 'default').
 * @param {string} service - Optional service name to filter by.
 * @returns {boolean} True if listeners were successfully removed.
 */
_ws.removeAllListeners = (key = 'default', service) => {
    if (servicesListeners[key]) {
        if (!service) {
            delete servicesListeners[key];
            return true;
        }
        service = ensureServicePrefix(key, service);
        if (servicesListeners[key][service]) {
            delete servicesListeners[key][service];
            return true;
        }
    }
    return false;
};

export default _ws;
