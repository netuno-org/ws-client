# ws-client

Client to integrations with Netuno WebSocket and Services.

More about the [Netuno Platform](https://netuno.org/).

This module makes is easy to support WebSocket in web applications.

### Install

`npm i -S @netuno/ws-client`

### Import

`import _ws from '@netuno/ws-client';`

### Config

Defines the main events:

```
_ws.config({
    url: 'ws://localhost:9000/ws/example',
    servicesPrefix: '/services',
    method: 'GET', 
    connect: (event) => {
        ...
    },
    close: (event) => {
        ...
    },
    error: (error) => {
        ...
    },
    message: (data, event) => {
        ...
    }
});
```

### Connect

```
_ws.connect();
```

### Close

```
_ws.close();
```

### Listener

Add listener:

```
const listenerRef = _ws.addListener({
    method: 'GET', // Optional
    service: "my/service",
    success: (data) => {
        ...
    },
    fail: (error)=> {
        ...
    }
});
```

Remove listener:

```
_ws.removeListener(listenerRef);
```

### Send Service

Send data to the service, and the output comes in the associated listener.

```
_ws.sendService({
    method: 'GET', // Optional
    service: 'my/service',
    data: {
        message: 'Hi...' 
    }
});
```
