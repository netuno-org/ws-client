# ws-client

WebSocket integrations for the Netuno Platform services.

<a href="https://www.npmjs.com/package/@netuno/ws-client"><img src="https://img.shields.io/npm/v/@netuno/ws-client.svg?style=flat" alt="npm version"></a>

More about the [Netuno Platform](https://netuno.org/).

This module makes it easy to call Netuno services over WebSocket in browser applications.

### Install

```bash
bun add @netuno/ws-client
```

### Import

```js
import _ws from '@netuno/ws-client';
```

### Config

Configure the default connection before opening it. `url` accepts an absolute `ws://` or `wss://` URL, or a root-relative path such as `/ws/example`:

```js
_ws.config({
    url: 'ws://localhost:9000/ws/example',
    servicesPrefix: '/services',
    autoReconnect: true,
    connect: (event, key) => {
        // ...
    },
    close: (event, key) => {
        // ...
    },
    error: (error, key) => {
        // ...
    },
    message: (data, event, key) => {
        // ...
    }
});
```

The defaults are `url: null`, `servicesPrefix: '/services'`, `method: 'GET'`, `autoReconnect: true`, and no-op `connect`, `close`, `error`, and `message` callbacks. The connection-level `method` value is retained for compatibility but is not read when sending services; `sendService` applies its own `GET` default. The `message` callback receives every incoming message, and JSON messages are parsed before delivery. Calling `_ws.config()` without arguments returns a copy of the current default configuration.

### Public API

| API | Behavior |
| --- | --- |
| `_ws([key], [options])` | Shorthand for `_ws.connect([key], [options])`. |
| `_ws.config([key], [settings])` | Merges settings and returns a detached copy for the default or named connection. |
| `_ws.isConnected([key])` | Reports whether the selected socket is open. |
| `_ws.connect([key], [options])` | Opens the selected connection, replacing an already connected socket. |
| `_ws.close([key])` | Intentionally closes the socket and cancels pending reconnection. |
| `_ws.send([key], message)` | Sends a text or JSON-style message only when connected. |
| `_ws.sendService([key], request)` | Prefixes and sends a service request, with optional inline listener callbacks. |
| `_ws.addListener([key], listener)` | Registers a service listener and returns its reference string. |
| `_ws.removeListener(reference)` | Removes the listener encoded by a reference returned from `addListener`. |
| `_ws.getAllListeners([key], [service])` | Returns listener maps for a connection or service. Returns `null` only when the connection has no listener registry yet, or when a specific service has no listeners. |
| `_ws.removeAllListeners([key], [service])` | Clears listeners for a connection or specific service. Returns `true` when a registry existed and was cleared, otherwise `false`. |

### Connect

```js
_ws.connect();
```

Check the connection state with `_ws.isConnected()`.

### Close

```js
_ws.close();
```

An intentional close also cancels automatic reconnection.

### Multiple Connections

Pass a key as the first argument to maintain an independent connection. A named connection must provide its complete configuration:

```js
_ws.config('notifications', {
    url: '/ws/notifications',
    servicesPrefix: '/services',
    autoReconnect: true,
    connect: () => {},
    close: () => {},
    error: () => {},
    message: () => {}
});

_ws.connect('notifications');
_ws.isConnected('notifications');
_ws.close('notifications');
```

The connection key can likewise be supplied as the first argument to `send`, `sendService`, `addListener`, `getAllListeners`, and `removeAllListeners`.

### Listener

The listener observes the execution of a specific service and is used to inject behaviors such as events.

The listener executes these callbacks when the specified service is called:

- `start` - before the service request is sent via WebSocket.
- `success` - when the response status is between 200 and 299.
- `fail` - when the response status is outside the 200–299 range.
- `end` - after the service response is handled.

> The service path is required. The HTTP method is optional; when omitted, the listener accepts responses for every method on that service.

See how to define a listener:

```js
const listenerRef = _ws.addListener({
    method: 'GET', // Optional
    service: "my/service",
    start: () => { /* ... */ }, // Optional
    success: (data) => {
        // ...
    },
    fail: (error)=> {
        // ...
    },
    end: () => { /* ... */ } // Optional
});
```

Remove listener:

```js
_ws.removeListener(listenerRef);
```

To inspect all listeners:

```js
console.warn("WS :: All Listeners:", _ws.getAllListeners());
```

Pass a service path as the second argument to inspect only that service on a keyed connection, for example `_ws.getAllListeners('default', 'my/service')`. The method returns `null` when there are no matching listeners.

To remove all listeners:

```js
_ws.removeAllListeners();
```

`removeAllListeners` also accepts an optional connection key and service path. It returns `true` when it removed listeners and `false` when none matched.

### Send a Message

Send a plain text payload or a message object over the default connection:

```js
_ws.send({
    content: 'Hello'
});

_ws.send({
    content: {
        action: 'refresh'
    }
});
```

Messages are sent only while the selected WebSocket is connected.

### Send Service

Send data to a service; matching listeners receive its response.

> The service path is required. The HTTP method is optional and defaults to `GET`.

```js
_ws.sendService({
    method: 'GET', // Optional
    service: 'my/service',
    data: {
        params: 'values here' 
    }
});
```

### Send Service with a Listener

`sendService` also accepts listener callbacks directly for simple, one-time requests.

Send data to the service, and the output will be received in the `success` or `fail` event.

It is useful when it is not necessary to keep the listener, for one-time service execution.

> A temporary listener is created in the background and removed after the response is handled.

```js
_ws.sendService({
    method: 'POST', // Optional
    service: 'my/service',
    data: {
        param: 'code' 
    },
    start: () => { /* ... */ }, // Optional
    success: (data) => {
        // ...
    },
    fail: (error)=> {
        // ...
    },
    end: () => { /* ... */ } // Optional
});
```

## React Integration

When integrating with React, register the listener in a `useEffect` hook.

The `useEffect` return function removes the listener when the component is destroyed.

See this example:

```jsx
import {useEffect, useState} from "react";

import {Spin, Button, notification} from "antd";

import _ws from "@netuno/ws-client";

import Item from "./Item";

function ProductList() {
    const [loading, setLoading] = useState(true);
    const [list, setList] = useState(null);
    useEffect(() => {
        const listenerRef = _ws.addListener({
            service: "product/list",
            start: () => {
                setLoading(true);
            },
            success: (data) => {
                setList(data.content);
            },
            fail: (error) => {
                console.error("Service product/list failed.", error);
                notification.error({
                    title: "Product List",
                    description: `Failed with status code ${error.status}.`
                })
            },
            end: () => {
                setLoading(false);
            }
        });
        onLoad();
        return () => {
            _ws.removeListener(listenerRef);
        }
    }, []);
    const onLoad = () => {
        _ws.sendService({
            service: "product/list"
        });
    };
    return (
        <div>
            {loading && <Spin/>}
            {!loading && <Button onClick={onLoad}>Update</Button>}
            {list && <ul>
                {list.map(({uid, name}) => (
                    <Item
                        key={uid}
                        uid={uid}
                        name={name}
                    />
                ))}
            </ul>}
        </div>
    );
}

export default ProductList;
```
