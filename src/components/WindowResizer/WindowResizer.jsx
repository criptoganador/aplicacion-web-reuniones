import { useEffect, useRef } from 'react';
import './WindowResizer.css';

const WindowResizer = () => {
  // Solo renderizar si estamos en Electron
  if (!window.electron) return null;

  const handleResize = (direction) => (e) => {
    e.preventDefault();
    
    // Si queremos usar la API nativa de Electron para resize (más suave en algunos casos)
    // podríamos enviar un IPC, pero window.resizeBy suele funcionar bien.
    // Sin embargo, para mayor fluidez y evitar problemas de CSS, usaremos IPC start-resizing si fuera necesario.
    // Por ahora, probaremos con lógica JS pura en frontend que suele ser suficiente para props simples.
    
    const startX = e.clientX;
    const startY = e.clientY;
    
    // NOTA: window.resizeBy funciona relativo al tamaño actual.
    // Pero mover el mouse en React y actualizar el window size puede ser "janky".
    // La MEJOR forma en Electron frameless es usar ipcRenderer.send('start-resizing', direction)
    // y dejar que el Main process maneje el loop nativo del OS, pero eso requiere código nativo C++ a veces.
    
    // Método JS simple:
    const onMouseMove = (moveEvent) => {
      // Necesitamos comunicar al Main process el nuevo tamaño.
      // Pero resizeBy desde renderer puede ser bloqueado o lento.
      // Vamos a intentar usar el "resize hack" de IPC si esto no va fluido.
      
      // En realidad, para Windows frameless + transparent, lo mejor es NO hacer resizing JS manual
      // si podemos evitarlo. Pero el usuario pidió explícitamente "poner el cursor en la línea".
      // Vamos a probar enviando comandos al main process vía IPC expuesto.
      
      const deltaX = moveEvent.screenX - e.screenX; // Usar screenX/Y es más estable
      // Un momento... 'e' es el evento inicial.
    };

    // CAMBIO DE ESTRATEGIA:
    // La forma más robusta en Electron moderno sin módulos nativos es capturar el mousedown
    // y enviar un mensaje al Main process para que inicie "resizing" si soporta la API,
    // o simplemente hacer los cálculos aquí y enviar window.setBound.
    
    // Vamos a usar la implementación "JS puro" enviando `resize` al main process.
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', () => {
      document.removeEventListener('mousemove', onMouseMove);
    });
  };

  // ESTRATEGIA DEFINITIVA:
  // Usar estos divs solo como "Triggers" visuales y de cursor.
  // Y usar CSS `-webkit-app-region: no-drag` para permitir que el OS capture el borde?
  // No, con `transparent: true` el hit-test falla.
  
  // Vamos a usar una implementación probada:
  // Enviar un mensaje 'resize-window' con los deltas.
  
  return (
    <>
      <div className="resizer resizer-t" onMouseDown={handleDrag('top')} />
      <div className="resizer resizer-r" onMouseDown={handleDrag('right')} />
      <div className="resizer resizer-b" onMouseDown={handleDrag('bottom')} />
      <div className="resizer resizer-l" onMouseDown={handleDrag('left')} />
      <div className="resizer resizer-nw" onMouseDown={handleDrag('nw')} />
      <div className="resizer resizer-ne" onMouseDown={handleDrag('ne')} />
      <div className="resizer resizer-sw" onMouseDown={handleDrag('sw')} />
      <div className="resizer resizer-se" onMouseDown={handleDrag('se')} />
    </>
  );
};

// ... Espera, la lógica de JS es compleja.
// Vamos a usar un enfoque más directo:
// Crear los divs y usar javascript para calcular `window.resizeTo`.

export default function WindowResizerSimple() {
  if (!window.electron) return null;

  useEffect(() => {
    const handleMouseDown = (e, direction) => {
      e.preventDefault();
      
      let lastX = e.screenX;
      let lastY = e.screenY;
      
      const onMouseMove = (moveEvent) => {
        const currentX = moveEvent.screenX;
        const currentY = moveEvent.screenY;

        const deltaX = currentX - lastX;
        const deltaY = currentY - lastY;

        if (deltaX === 0 && deltaY === 0) return;

        window.electron.windowControls.resize({ 
          direction, 
          deltaX, 
          deltaY 
        });

        lastX = currentX;
        lastY = currentY;
      };

      
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    // Asignar listeners a los elementos del DOM es mejor que pasar callbacks
    document.querySelectorAll('.resizer').forEach(el => {
      el.onmousedown = (e) => handleMouseDown(e, el.dataset.direction);
    });
    
  }, []);

  return (
    <div className="window-resizers">
      <div className="resizer top" data-direction="n" />
      <div className="resizer right" data-direction="e" />
      <div className="resizer bottom" data-direction="s" />
      <div className="resizer left" data-direction="w" />
      <div className="resizer top-left" data-direction="nw" />
      <div className="resizer top-right" data-direction="ne" />
      <div className="resizer bottom-left" data-direction="sw" />
      <div className="resizer bottom-right" data-direction="se" />
    </div>
  );
}
