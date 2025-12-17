import { useState, useEffect, useRef } from 'react';

/**
 * Hook para navegación con teclado/control remoto
 * Maneja navegación horizontal tipo Netflix
 * 
 * @param {Array} items - Array de items navegables
 * @param {Function} onSelect - Callback cuando se selecciona un item
 * @param {Object} options - Opciones de configuración
 * @returns {Object} Estado y funciones de navegación
 */
export function useKeyboardNavigation(items = [], onSelect, options = {}) {
  const {
    loop = true, // Si true, vuelve al inicio al llegar al final
    initialIndex = 0,
    disabled = false,
    orientation = 'horizontal', // 'horizontal' | 'vertical'
  } = options;

  const [focusedIndex, setFocusedIndex] = useState(initialIndex);
  const containerRef = useRef(null);
  const itemRefs = useRef([]);

  // Actualizar focusedIndex cuando cambia initialIndex
  useEffect(() => {
    if (initialIndex >= 0 && initialIndex < items.length) {
      setFocusedIndex(initialIndex);
    }
  }, [initialIndex, items.length]);

  // Scroll al item con focus
  useEffect(() => {
    if (itemRefs.current[focusedIndex] && containerRef.current) {
      const item = itemRefs.current[focusedIndex];
      const container = containerRef.current;
      
      const itemRect = item.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Scroll horizontal
      if (orientation === 'horizontal') {
        if (itemRect.left < containerRect.left) {
          container.scrollTo({
            left: container.scrollLeft + (itemRect.left - containerRect.left) - 20,
            behavior: 'smooth'
          });
        } else if (itemRect.right > containerRect.right) {
          container.scrollTo({
            left: container.scrollLeft + (itemRect.right - containerRect.right) + 20,
            behavior: 'smooth'
          });
        }
      } else {
        // Scroll vertical
        if (itemRect.top < containerRect.top) {
          container.scrollTo({
            top: container.scrollTop + (itemRect.top - containerRect.top) - 20,
            behavior: 'smooth'
          });
        } else if (itemRect.bottom > containerRect.bottom) {
          container.scrollTo({
            top: container.scrollTop + (itemRect.bottom - containerRect.bottom) + 20,
            behavior: 'smooth'
          });
        }
      }
    }
  }, [focusedIndex, orientation]);

  // Manejar teclas del teclado/control remoto
  useEffect(() => {
    if (disabled || items.length === 0) return;

    const handleKeyDown = (e) => {
      // No interceptar si está escribiendo en un input o textarea
      const target = e.target;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Permitir navegación dentro del input (flechas para mover cursor)
        return;
      }

      let newIndex = focusedIndex;

      if (orientation === 'horizontal') {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          newIndex = loop
            ? (focusedIndex + 1) % items.length
            : Math.min(focusedIndex + 1, items.length - 1);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          newIndex = loop
            ? (focusedIndex - 1 + items.length) % items.length
            : Math.max(focusedIndex - 1, 0);
        }
      } else {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          newIndex = loop
            ? (focusedIndex + 1) % items.length
            : Math.min(focusedIndex + 1, items.length - 1);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          newIndex = loop
            ? (focusedIndex - 1 + items.length) % items.length
            : Math.max(focusedIndex - 1, 0);
        }
      }

      if ((e.key === 'Enter' || e.key === ' ') && onSelect) {
        e.preventDefault();
        onSelect(items[focusedIndex], focusedIndex);
        return;
      }

      if (newIndex !== focusedIndex) {
        setFocusedIndex(newIndex);
        // Focus visual en el elemento
        if (itemRefs.current[newIndex]) {
          itemRefs.current[newIndex].focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, items, loop, orientation, disabled, onSelect]);

  // Función para mover focus programáticamente
  const moveFocus = (direction) => {
    let newIndex = focusedIndex;
    
    if (orientation === 'horizontal') {
      if (direction === 'next') {
        newIndex = loop
          ? (focusedIndex + 1) % items.length
          : Math.min(focusedIndex + 1, items.length - 1);
      } else if (direction === 'prev') {
        newIndex = loop
          ? (focusedIndex - 1 + items.length) % items.length
          : Math.max(focusedIndex - 1, 0);
      }
    } else {
      if (direction === 'down') {
        newIndex = loop
          ? (focusedIndex + 1) % items.length
          : Math.min(focusedIndex + 1, items.length - 1);
      } else if (direction === 'up') {
        newIndex = loop
          ? (focusedIndex - 1 + items.length) % items.length
          : Math.max(focusedIndex - 1, 0);
      }
    }

    setFocusedIndex(newIndex);
    if (itemRefs.current[newIndex]) {
      itemRefs.current[newIndex].focus();
    }
  };

  return {
    focusedIndex,
    setFocusedIndex,
    containerRef,
    itemRefs,
    moveFocus,
  };
}

