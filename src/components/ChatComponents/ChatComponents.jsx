import { useState } from 'react';
import { Edit2, Trash2, Search, Download, Loader, X } from 'lucide-react';
import './ChatComponents.css';

/**
 * Componente de acciones para cada mensaje (editar/eliminar)
 */
export function MessageActions({ message, onEdit, onDelete, isOwnMessage, localUserId }) {
  const [showMenu, setShowMenu] = useState(false);
  
  // Solo mostrar si es tu mensaje y tiene ID de DB
  if (!isOwnMessage || !message.id || message.source !== 'db') return null;
  
  return (
    <div className="message-actions-wrapper">
      <button 
        className="message-menu-trigger"
        onClick={() => setShowMenu(!showMenu)}
        aria-label="Opciones de mensaje"
      >
        ⋯
      </button>
      
      {showMenu && (
        <div className="message-actions-menu">
          <button onClick={() => {
            onEdit(message);
            setShowMenu(false);
          }}>
            <Edit2 size={14} />
            Editar
          </button>
          
          <button onClick={() => {
            if (window.confirm('¿Eliminar este mensaje?')) {
              onDelete(message.id);
              setShowMenu(false);
            }
          }} className="delete-action">
            <Trash2 size={14} />
            Eliminar
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Componente de búsqueda en el chat
 */
export function ChatSearch({ query, setQuery, results, isSearching, onResultClick }) {
  return (
    <div className="chat-search-container">
      <div className="search-input-wrapper">
        <label htmlFor="chat-search-input" className="sr-only">Buscar en el chat</label>
        <Search size={18} />
        <input 
          id="chat-search-input"
          name="chatSearch"
          type="text"
          placeholder="Buscar en el chat..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="search-input"
        />
        {isSearching && <Loader size={16} className="search-spinner spinning" />}
        {query && (
          <button 
            onClick={() => setQuery('')}
            className="search-clear-btn"
            aria-label="Limpiar búsqueda"
          >
            <X size={16} />
          </button>
        )}
      </div>
      
      {results.length > 0 && (
        <div className="search-results-list">
          <div className="search-results-header">
            {results.length} resultado{results.length !== 1 ? 's' : ''}
          </div>
          {results.map((result) => (
            <div 
              key={result.id} 
              className="search-result-item"
              onClick={() => {
                onResultClick(result);
                setQuery('');
              }}
            >
              <div className="result-sender">{result.sender.name}</div>
              <div className="result-message">
                {highlightQuery(result.message, query)}
              </div>
              <div className="result-time">
                {new Date(result.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {query && results.length === 0 && !isSearching && (
        <div className="search-no-results">
          No se encontraron resultados para "{query}"
        </div>
      )}
    </div>
  );
}

/**
 * Helper para resaltar query en resultados
 */
function highlightQuery(text, query) {
  if (!query) return text;
  
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() 
          ? <mark key={i} className="search-highlight">{part}</mark> 
          : part
      )}
    </span>
  );
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Componente de indicador de "escribiendo..."
 */
export function TypingIndicator({ typingUsers }) {
  if (typingUsers.size === 0) return null;
  
  const users = Array.from(typingUsers).slice(0, 3);
  const moreCount = typingUsers.size - users.length;
  
  return (
    <div className="typing-indicator">
      <div className="typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <span className="typing-text">
        {users.join(', ')}
        {moreCount > 0 && ` y ${moreCount} más`}
        {' están escribiendo'}...
      </span>
    </div>
  );
}

/**
 * Componente para exportar chat
 */
export function ExportChatButton({ onExport, isExporting }) {
  const [showMenu, setShowMenu] = useState(false);
  
  return (
    <div className="export-chat-container">
      <button 
        className="export-chat-btn"
        onClick={() => setShowMenu(!showMenu)}
        disabled={isExporting}
      >
        <Download size={18} />
        {isExporting ? 'Exportando...' : 'Exportar Chat'}
      </button>
      
      {showMenu && !isExporting && (
        <div className="export-format-menu">
          <button onClick={() => {
            onExport('txt');
            setShowMenu(false);
          }}>
            📄 Texto (.txt)
          </button>
          <button onClick={() => {
            onExport('json');
            setShowMenu(false);
          }}>
            📊 JSON (.json)
          </button>
          <button onClick={() => {
            onExport('csv');
            setShowMenu(false);
          }}>
            📈 CSV (.csv)
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Componente de modal de edición
 */
export function EditMessageModal({ message, onSave, onCancel }) {
  const [editedText, setEditedText] = useState(message.message);
  const [isSaving, setIsSaving] = useState(false);
  
  const handleSave = async () => {
    if (editedText.trim() === '') return;
    if (editedText === message.message) {
      onCancel();
      return;
    }
    
    setIsSaving(true);
    await onSave(message.id, editedText);
    setIsSaving(false);
  };
  
  return (
    <div className="edit-modal-overlay" onClick={onCancel}>
      <div className="edit-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="edit-modal-header">
          <h3>Editar mensaje</h3>
          <button onClick={onCancel} className="close-modal-btn">
            <X size={20} />
          </button>
        </div>
        
        <div className="edit-modal-body">
          <label htmlFor="edit-message-textarea" className="sr-only">Editar contenido del mensaje</label>
          <textarea 
            id="edit-message-textarea"
            name="editedMessage"
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="edit-textarea"
            placeholder="Escribe tu mensaje..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Escape') onCancel();
              if (e.key === 'Enter' && e.ctrlKey) handleSave();
            }}
          />
          <div className="edit-hint">
            Presiona Ctrl+Enter para guardar, Esc para cancelar
          </div>
        </div>
        
        <div className="edit-modal-footer">
          <button onClick={onCancel} className="cancel-btn" disabled={isSaving}>
            Cancelar
          </button>
          <button 
            onClick={handleSave} 
            className="save-btn"
            disabled={isSaving || editedText.trim() === ''}
          >
            {isSaving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
