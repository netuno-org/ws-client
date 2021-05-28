import extend from 'just-extend';

let connected = false;
let closed = true;

const config = {
    url: null,
    servicesPrefix: '/services',
    method: 'GET',
    connect: (event) => { },
    close: (event) => { },
    error: (error) => { },
    message: (data, event) => { }
};

let webSocket = null;

const servicesListeners = {};

const ensureServicePrefix = (service) => {
    if (service.startsWith(config.servicesPrefix)) {
        return service;
    }
    if (config.servicesPrefix.endsWith('/') && service.startsWith('/')) {
        service = service.substring(1);
    } else if (!config.servicesPrefix.endsWith('/') && !service.startsWith('/')) {
        service = '/'+ service;
    }
    return config.servicesPrefix + service;
};

const _ws = (args) => {
    _ws.connect(args);
};

_ws.config = (settings) => {
    if (!!settings) {
        extend(true, config, settings);
    }
    const newConfig = {};
    extend(true, newConfig, config);
    return newConfig;
};

_ws.isConnected = ()=> {
    return connected;
};

_ws.connect = (args)=> {
    closed = false;
    const settings = {};
    extend(true, settings, config);
    extend(true, settings, args);
    if (webSocket != null && connected) {
        webSocket.close();
    }
    webSocket = new WebSocket(`${config.url}`);
    webSocket.onopen = (event) => {
        connected = true;
        settings.connect(event);
    };
    webSocket.onclose = (event) => {
        connected = false;
        settings.close(event);
    };
    webSocket.onerror = (error) => {
        connected = false;
        settings.error(error);
        webSocket.close();
    };
    webSocket.onmessage = (event) => {
        let data = event.data;
        try {
            data = JSON.parse(event.data);
        } catch { }
        settings.message(data, event);
        debugger;
        const service = ensureServicePrefix(data.service);
        if (typeof(data.service) == "string" && servicesListeners[service]) {
            servicesListeners[service].forEach((listenerData) => {
                if (typeof(listenerData.method) !== "string"
                    || listenerData.method.toUpperCase() === data.method.toUpperCase()) {
                    if (listenerData.success && data.status >= 200 && data.status <= 299) {
                        listenerData.success(data, event);
                    } else if (listenerData.fail) {
                        listenerData.fail(data, event);
                    }
                }
            });
        }
    };
};

_ws.close = () => {
    closed = true;
    if (connected) {
        webSocket.close();
    }
};

_ws.send = (args)=> {
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
    if (connected) {
        webSocket.send(JSON.stringify(message));
    }
};

_ws.sendService = (args)=> {
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
        message.service = ensureServicePrefix(message.service);
    }
    if (connected) {
        webSocket.send(JSON.stringify(message));
    }
};

_ws.addListener = (data) => {
    const service = ensureServicePrefix(data.service);
    if (typeof(servicesListeners[service]) == "undefined") {
        servicesListeners[service] = [ ];
    }
    servicesListeners[service].push(data);
    return service +':'+ (servicesListeners[service].length - 1);
};

_ws.removeListener = (ref) => {
    const refParts = ref.split(':');
    const service = refParts[0];
    const index = parseInt(refParts[1], 10);
    servicesListeners[service].splice(index, 1);
};

_ws.tick = () => {
    if (!connected && !closed) {
        _ws.connect();
    }
    window.setTimeout(() => _ws.tick(), 1000);
};

_ws.tick();

export default _ws;