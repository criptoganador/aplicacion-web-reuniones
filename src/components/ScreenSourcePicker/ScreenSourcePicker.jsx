import React, { useEffect, useState } from 'react';
import { X, Monitor, Laptop } from 'lucide-react';
import './ScreenSourcePicker.css';

const ScreenSourcePicker = ({ onClose, onSelect }) => {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // DRAGGING STATE
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const fetchSources = async () => {
      if (window.electron && window.electron.getSources) {
        try {
          const res = await window.electron.getSources();
          setSources(res);
        } catch (err) {
          console.error('Error fetching sources:', err);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchSources();
  }, []);

  // DRAG HANDLERS
  const onMouseDown = (e) => {
    // Only allow drag starting from the header (excluding the close button)
    if (e.target.closest('.screen-picker-close')) return;
    
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  useEffect(() => {
    const onMouseMove = (e) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
    };

    const onMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    } else {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, dragOffset]);

  return (
    <div className="screen-picker-overlay">
      <div 
        className={`screen-picker-modal ${isDragging ? 'dragging' : ''}`}
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      >
        <div className="screen-picker-header" onMouseDown={onMouseDown}>
          <h3>Compartir pantalla</h3>
          <button onClick={onClose} className="screen-picker-close">
            <X size={20} />
          </button>
        </div>
        <div className="screen-picker-content">
          {loading ? (
            <div className="screen-picker-loader">Cargando fuentes...</div>
          ) : sources.length === 0 ? (
            <div className="screen-picker-empty">No se encontraron fuentes de pantalla.</div>
          ) : (
            <div className="screen-picker-grid">
              {sources.map((source) => (
                <div 
                  key={source.id} 
                  className="screen-source-item"
                  onClick={() => onSelect(source.id)}
                >
                  <div className="screen-source-thumbnail">
                    <img src={source.thumbnail} alt={source.name} />
                  </div>
                  <div className="screen-source-info">
                    {source.id.startsWith('screen') ? <Monitor size={14} /> : <Laptop size={14} />}
                    <span>{source.name}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScreenSourcePicker;
