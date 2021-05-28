import React, { useEffect, useState, useRef } from 'react';

import logo from './logo.svg';

import Sandbox from './Sandbox.js';

import './App.css';

function App() {
    const [ showSandbox, setShowSandbox ] = useState(true);
    if (!showSandbox) {
        return (
            <button onClick={ ()=> setShowSandbox(true) }>Show Sandbox</button>
        );
    }
    return (
        <div className="App">
          { showSandbox ? <Sandbox /> : null}
          <button onClick={ ()=> setShowSandbox(false) }>Close Sandbox</button>
        </div>
    );
}

export default App;
