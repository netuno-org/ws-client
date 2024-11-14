import extend from 'just-extend';

const connected = {
  'default': false
};
const closed = {
  'default': true
};

const configs = {
  'default': {
    url: null,
    servicesPrefix: '/services',
    method: 'GET',
    connect: (event) => { },
    close: (event) => { },
    error: (error) => { },
    message: (data, event) => { },
    autoReconnect: true
  }
};

const webSocket = {};

const servicesListeners = {};

const timeoutAutoReconnect = {};

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

_ws.config = (key = 'default', settings) => {
    if (!settings && key && typeof key === 'object') {
        settings = key;
        key = 'default';
    }
    if (!!settings) {
        extend(true, configs[key], settings);
    }
    const newConfig = {};
    extend(true, newConfig, configs[key]);
    return newConfig;
};

_ws.isConnected = (key = 'default')=> {
    return connected[key];
};

_ws.connect = (key = 'default', args)=> {
    if (!args && key && typeof key === 'object') {
      args = key;
      key = 'default';
    }
    if (timeoutAutoReconnect[key] != null) {
        window.clearTimeout(timeoutAutoReconnect[key]);
        timeoutAutoReconnect[key] = null;
    }
    closed[key] = false;
    const settings = {};
    extend(true, settings, configs[key]);
    extend(true, settings, args);
    if (webSocket[key] != null && connected[key]) {
        webSocket[key].close();
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
        settings.connect(event);
    };
    webSocket[key].onclose = (event) => {
        connected[key] = false;
        settings.close(event);
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
        settings.error(error);
        webSocket[key].close();
    };
    webSocket[key].onmessage = (event) => {
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

_ws.send = (key = 'default', args)=> {
    if (!args && key && typeof key === 'object') {
      args = key;
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

_ws.sendService = (key = 'default', args)=> {
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
    if (connected[key]) {
        webSocket[key].send(JSON.stringify(message));
    }
};

_ws.addListener = (key = 'default', data) => {
    const service = ensureServicePrefix(data.service);
    if (typeof(servicesListeners[key][service]) == "undefined") {
        servicesListeners[key][service] = [ ];
    }
    servicesListeners[key][service].push(data);
    return key +':'+ service +':'+ (servicesListeners[key][service].length - 1);
};

_ws.removeListener = (ref) => {
    const refParts = ref.split(':');
    const key = refParts[0];
    const service = refParts[1];
    const index = parseInt(refParts[2], 10);
    servicesListeners[key][service].splice(index, 1);
};

export default _ws;
