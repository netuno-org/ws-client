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
    message: (data, event) => { },
    autoReconnect: true
};

let webSocket = null;

const servicesListeners = {};

let timeoutAutoReconnect = null;

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
    if (timeoutAutoReconnect != null) {
        window.clearTimeout(timeoutAutoReconnect);
        timeoutAutoReconnect = null;
    }
    closed = false;
    const settings = {};
    extend(true, settings, config);
    extend(true, settings, args);
    if (webSocket != null && connected) {
        webSocket.close();
    }
    let { url } = settings;
    if (url && url.indexOf('/') == 0) {
        let protocol = 'ws:';
        if (window.location.protocol == 'https:') {
            protocol = 'wss:';
        }
        let frontendServer = false;
        let hostname = '';
        let port = '';
        if (window.location.host.indexOf(':')) {
            hostname = window.location.host.substring(0, window.location.host.indexOf(':'));
            port = window.location.host.substring(window.location.host.indexOf(':') + 1);
        }
        if (port == '3000') {
            frontendServer = true;
            port = '9000';
        }
        if (port.length > 2 && port.substring(port.length - 2, port.length) == '30') {
            frontendServer = true;
            port = port.substring(0, port.length - 2) + '90';
        }
        if (frontendServer) {
            endpoint = `${protocol}//${hostname}:${port}${url}`;
        } else {
            url = `${protocol}//${window.location.host}${url}`;
        }
    }
    webSocket = new WebSocket(url);
    webSocket.onopen = (event) => {
        if (timeoutAutoReconnect != null) {
            window.clearTimeout(timeoutAutoReconnect);
            timeoutAutoReconnect = null;
        }
        connected = true;
        settings.connect(event);
    };
    webSocket.onclose = (event) => {
        connected = false;
        settings.close(event);
        if (settings.autoReconnect && closed === false) {
            if (timeoutAutoReconnect != null) {
                window.clearTimeout(timeoutAutoReconnect);
                timeoutAutoReconnect = null;
            }
            timeoutAutoReconnect = window.setTimeout(()=> { _ws.connect(settings); }, 1000);
        }
    };
    webSocket.onerror = (error) => {
        if (timeoutAutoReconnect != null) {
            window.clearTimeout(timeoutAutoReconnect);
            timeoutAutoReconnect = null;
        }
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
    if (timeoutAutoReconnect != null) {
        window.clearTimeout(timeoutAutoReconnect);
        timeoutAutoReconnect = null;
    }
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

export default _ws;
