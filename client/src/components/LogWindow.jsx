import React, { useState, useEffect } from 'react';

export default function LogWindow() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    // Generate initial startup logs
    const initialLogs = [
      { time: new Date().toLocaleTimeString(), type: 'INFO', text: 'Terminal initialized successfully.' },
      { time: new Date().toLocaleTimeString(), type: 'WS', text: 'Connected to NSE WebSocket feed on ws://localhost:3000' },
      { time: new Date().toLocaleTimeString(), type: 'RMS', text: 'Pre-Trade risk engine active. Zero circuit breaches.' }
    ];
    setLogs(initialLogs);

    // Simulate occasional incoming log updates
    const interval = setInterval(() => {
      const newLog = {
        time: new Date().toLocaleTimeString(),
        type: 'HEARTBEAT',
        text: 'WebSocket connection healthy. Latency: 12ms'
      };
      setLogs(prev => [newLog, ...prev.slice(0, 15)]); // Keep last 15 logs
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px' }}>
      <div style={{ padding: '4px 0 12px 0', fontSize: '13px', color: '#627d98', display: 'flex', justifyContent: 'space-between' }}>
        <span>System Diagnostic Console</span>
        <button 
          onClick={() => setLogs([])}
          style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '11px' }}
        >
          Clear
        </button>
      </div>

      <div style={{ flex: 1, backgroundColor: '#0b0f19', padding: '10px', borderRadius: '6px', border: '1px solid #1e293b', overflowY: 'auto' }}>
        {logs.map((log, index) => (
          <div key={index} style={{ marginBottom: '8px', lineHeight: '1.4' }}>
            <span style={{ color: '#64748b' }}>[{log.time}]</span>{' '}
            <span style={{ color: log.type === 'RMS' ? '#f87171' : log.type === 'WS' ? '#38bdf8' : '#4ade80', fontWeight: 'bold' }}>
              {log.type}:
            </span>{' '}
            <span style={{ color: '#cbd5e1' }}>{log.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}