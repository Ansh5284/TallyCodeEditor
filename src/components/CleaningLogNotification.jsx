import React, { useState } from 'react';
import useStore from '../lib/store';

export default function CleaningLogNotification() {
  const invalidCharsRemoved = useStore.use.invalidCharsRemoved();
  const cleaningLog = useStore.use.cleaningLog();
  const [isVisible, setIsVisible] = useState(true);

  if (invalidCharsRemoved === 0 || !isVisible) {
    return null;
  }

  return (
    <div className="cleaning-log-notification">
      <div className="cleaning-log-content">
        <span className="icon">info</span>
        <div className="cleaning-log-details">
          <p>
            This file required cleanup: {invalidCharsRemoved} invalid character(s) were removed to ensure compatibility.
          </p>
          <ul>
            {cleaningLog.map((log, index) => (
              <li key={index}>{log}</li>
            ))}
          </ul>
        </div>
      </div>
      <button 
        className="cleaning-log-close-btn" 
        onClick={() => setIsVisible(false)}
        title="Dismiss"
      >
        <span className="icon">close</span>
      </button>
    </div>
  );
}