import { useState } from 'react';
import { Minus, Square, X, Video } from 'lucide-react';
import './TitleBar.css';

const TitleBar = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  // Solo mostrar si estamos en Electron
  if (!window.electron) return null;

  const handleMinimize = () => {
    window.electron.windowControls.minimize();
  };

  const handleMaximize = () => {
    window.electron.windowControls.maximize();
    setIsMaximized(!isMaximized);
  };

  const handleClose = () => {
    window.electron.windowControls.close();
  };

  return (
    <div className="titlebar">
      <div className="titlebar-drag-region">
        <div className="titlebar-icon">
          <Video size={16} color="#1a73e8" />
        </div>
        <div className="titlebar-title">ASICME Meet</div>
      </div>

      <div className="titlebar-controls">
        <button className="titlebar-btn minimize" onClick={handleMinimize} title="Minimizar">
          <Minus size={16} />
        </button>
        <button className="titlebar-btn maximize" onClick={handleMaximize} title="Maximizar">
          <Square size={14} />
        </button>
        <button className="titlebar-btn close" onClick={handleClose} title="Cerrar">
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
