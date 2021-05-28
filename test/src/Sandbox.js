import React, { useEffect, useState, useRef } from 'react';

import _ws from '@netuno/ws-client';

import './Sandbox.css';

function Sandbox() {
    const [ connected, setConnected ] = useState(false);
    const [ error, setError ] = useState(null);
    const [ message, setMessage ] = useState(null);
    const [ listenerSuccessMessage, setListenerSuccessMessage ] = useState(null);
    const [ listenerErrorMessage, setListenerErrorMessage ] = useState(null);
    const inputMessage = useRef(null);
    useEffect(() => {
        _ws.config({
            url: 'ws://localhost:9000/socket/app/room/main',
            method: 'POST',
            connect: (event) => {
                setConnected(true);
            },
            close: (event) => {
                setConnected(false);
            },
            error: (error) => {
                setError(error);
            },
            message: (message, event) => {
                setMessage(message);
            }
        });
        _ws.connect();
        const listener = _ws.addListener({
            service: "test",
            success: (data) => {
                setListenerSuccessMessage(data);
            },
            fail: (error)=> {
                setListenerErrorMessage(error);
            }
        });
        return ()=> {
            _ws.removeListener(listener);
        };
    }, []);
    const onReset = ()=> {
        setMessage(null);
        setListenerSuccessMessage(null);
        setListenerErrorMessage(null);
    };
    return (
        <div className="App">
          <p>Connected: {connected ? "online" : "offline"}</p>
          <p>Error: {error ? JSON.stringify(error) : null}</p>
          <p>Message: {message ? JSON.stringify(message) : null}</p>
          <p>Listener Success Message: {listenerSuccessMessage ? JSON.stringify(listenerSuccessMessage) : null}</p>
          <p>Listener Error Message: {listenerErrorMessage ? JSON.stringify(listenerErrorMessage) : null}</p>
          <p>
            <textarea ref={ inputMessage } /><br/>
            <button onClick={ ()=> {
                onReset();
                _ws.sendService({
                    method: "POST",
                    service: 'test',
                    data: {
                        message: inputMessage.current.value
                    }
                });
            } }>Send</button>
            &nbsp;
            <button onClick={ onReset }>Reset</button>
          </p>
          <p>
            <button onClick={ ()=> {
                _ws.connect();
            }}>Connect</button>
            &nbsp;
            <button onClick={ ()=> {
                _ws.close();
            }}>Close</button>
          </p>
        </div>
    );
}

export default Sandbox;
