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
        servicesListeners[key][service] = [ ];
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
        console.log('message event', event);
        try {
            data = JSON.parse(event.data);
        } catch { }
        settings.message(data, event, key);
        if (typeof(data.service) == "string") {
            const service = ensureServicePrefix(key, data.service);
            getServiceListeners(key, service).forEach((listenerData) => {
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
    if (connected[key]) {
        webSocket[key].send(JSON.stringify(message));
    }
};

_ws.addListener = (keyOrData = 'default', data) => {
    let key = keyOrData;
    if (!data && keyOrData && typeof keyOrData === 'object') {
        data = keyOrData;
        key = 'default';
    }
    const service = ensureServicePrefix(key, data.service);
    getServiceListeners(key, service).push(data);
    return key +'~|~'+ service +'~|~'+ (getServiceListeners(key, service).length - 1);
};

_ws.removeListener = (ref) => {
    const refParts = ref.split('~|~');
    const key = refParts[0];
    const service = refParts[1];
    const index = parseInt(refParts[2], 10);
    getServiceListeners(key, service).splice(index, 1);
};

export default _ws;
