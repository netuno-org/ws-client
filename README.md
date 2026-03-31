# ws-client

WebSocket integrations for the Netuno Platform services.

<a href="https://www.npmjs.com/package/@netuno/ws-client"><img src="https://img.shields.io/npm/v/@netuno/ws-client.svg?style=flat" alt="npm version"></a>

More about the [Netuno Platform](https://netuno.org/).

This module makes is easy to support WebSocket in web applications.

### Install

`bun add @netuno/ws-client`

### Import

`import _ws from '@netuno/ws-client';`

### Config

Defines the main events:

```
_ws.config({
    url: 'ws://localhost:9000/ws/example',
    servicesPrefix: '/services',
    method: 'GET',
    autoReconnect: true,
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

The listener observes the execution of a specific service and is used to inject behaviors such as events.

The listener will execute these events when the service specified are executed:

- `start` - before the service request is sent via WebSocket.
- `success` - if the service executed very well.
- `fail` - if the service gives an error.
- `end` - after the service execution is ended.

> The listener must specify the HTTP method, which is `GET` by default.

See how to define a listener:

```
const listenerRef = _ws.addListener({
    method: 'GET', // Optional
    service: "my/service",
    start: () => { ... }, // Optional
    success: (data) => {
        ...
    },
    fail: (error)=> {
        ...
    },
    end: () => { ... } // Optional
});
```

Remove listener:

```
_ws.removeListener(listenerRef);
```

### Send Service

Send data to the service, and the output comes in the listener defined.

> The service path and the HTTP method must be specified, which by default is GET.

```
_ws.sendService({
    method: 'GET', // Optional
    service: 'my/service',
    data: {
        params: 'values here' 
    }
});
```

### Send Service with a Listener

Send service directly supports the listener events definition for simple cases.

Send data to the service, and the output will be received in the `success` or `fail` event.

It is useful when it is not necessary to keep the listener, for one-time service execution.

> In the background, a listener is auto-created, and it is auto-removed in the end.

```
_ws.sendService({
    method: 'POST', // Optional
    service: 'my/service',
    data: {
        param: 'code' 
    },
    start: () => { ... }, // Optional
    success: (data) => {
        ...
    },
    fail: (error)=> {
        ...
    },
    end: () => { ... } // Optional
});
```

## React Integration

When integrating with React, it's recommended to load the listener within the `useEffect` method used to create 
the component.

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
