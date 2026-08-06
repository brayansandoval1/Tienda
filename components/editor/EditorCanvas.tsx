'use client';

import { useEffect, useRef } from 'react';
import type { TextOptions } from '../../types/product';
import type { ProductConfig } from './products';

interface EditorCanvasProps {
  product: ProductConfig;
}

export default function EditorCanvas({ product: initialProduct }: EditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<any>(null);
  const safeZoneRef = useRef<any>(null);
  const historyRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const isRedoingUndoRef = useRef(false);
  const isUpdatingHistory = useRef(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    let isMounted = true;
    let handleAddText: (e: Event) => void,
      handleColorChange: (e: Event) => void,
      handleFontChange: (e: Event) => void,
      handleFontSizeChange: (e: Event) => void,
      handleAddImage: (e: Event) => void,
      handleSwitchProduct: (e: Event) => void,
      handleDelete: () => void,
      handleDuplicate: () => void,
      handleBringForward: () => void,
      handleSendBackward: () => void,
      handleKeyDown: (e: KeyboardEvent) => void,
      handleClear: () => void,
      handleUndo: () => void,
      handleRedo: () => void,
      handleAddShape: (e: Event) => void;

    // Carga dinámica de Fabric solo en el cliente
    import('fabric').then((fabricModule) => {
      if (!isMounted || !canvasRef.current) return;

      const fabric = fabricModule.fabric || fabricModule;
      const canvas = new (fabric as any).Canvas(canvasRef.current, {
        backgroundColor: '#F4F5F7',
      });

      fabricCanvasRef.current = canvas;

      const updateHistoryButtons = () => {
        window.dispatchEvent(
          new CustomEvent('editor:history-updated', {
            detail: {
              canUndo: historyRef.current.length > 1,
              canRedo: redoStackRef.current.length > 0,
            },
          }),
        );
      };

      const saveState = () => {
        if (isRedoingUndoRef.current || isUpdatingHistory.current || !fabricCanvasRef.current) return;
        const userObjects = canvas.getObjects().filter((obj: any) => !obj.isGuide);
        const jsonState = userObjects.map((obj: any) => obj.toJSON());
        historyRef.current.push(JSON.stringify(jsonState));
        redoStackRef.current = [];
        updateHistoryButtons();
      };

      const setupProduct = (product: ProductConfig) => {
        // Ajustar dimensiones del canvas de Fabric.js
        canvas.setWidth(product.canvasWidth);
        canvas.setHeight(product.canvasHeight);

        // Cargar la imagen de mockup en el fondo del canvas
        fabric.Image.fromURL(product.mockupUrl, (img) => {
          img.scaleToWidth(canvas.getWidth()); // Escalar para que se ajuste al ancho del canvas
          canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
            originX: 'left',
            originY: 'top',
            scaleX: img.scaleX, // Asegurar que el escalado se aplique
            scaleY: img.scaleY,
          });
        });

        // Eliminar la zona segura anterior si existe
        if (safeZoneRef.current) {
          canvas.remove(safeZoneRef.current);
        }

        // Dibujar la nueva zona segura
        const safeZone = new fabric.Rect({
          ...product.printArea,
          fill: 'transparent',
          stroke: '#16a34a', // Verde
          strokeWidth: 2,
          strokeDashArray: [8, 8],
          selectable: false,
          evented: false,
        });
        // Marcar como objeto de guía (propiedad personalizada)
        (safeZone as any).isGuide = true;
        safeZoneRef.current = safeZone;
        canvas.add(safeZone);
        canvas.renderAll();
        saveState();
      };

      setupProduct(initialProduct);

      // Helper para cargar Google Fonts dinámicamente
      const loadGoogleFont = (fontFamily: string) => {
        const id = `google-font-${fontFamily.replace(/\s+/g, '-').toLowerCase()}`;
        if (!document.getElementById(id)) {
          const link = document.createElement('link');
          link.id = id;
          link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, '+')}:wght@400;700&display=swap`;
          link.rel = 'stylesheet';
          document.head.appendChild(link);
        }
      };

      // --- Listeners para emitir eventos de selección ---
      const emitSelection = () => {
        const activeObject = canvas.getActiveObject();

        // Emitir evento unificado de cambio de selección (SIEMPRE con detail)
        window.dispatchEvent(new CustomEvent('editor:selection-changed', {
          detail: {
            selectedObject: activeObject ? {
              type: activeObject.type,
              fill: activeObject.get('fill') ?? '#000000',
              fontFamily: activeObject.get('fontFamily'),
              fontSize: activeObject.get('fontSize'),
            } : null
          }
        }));
      };

      canvas.on('selection:created', emitSelection);
      canvas.on('selection:updated', emitSelection);
      canvas.on('selection:cleared', () => {
        window.dispatchEvent(new CustomEvent('editor:selection-changed', {
          detail: { selectedObject: null }
        }));
      });

      // --- Listeners para recibir cambios desde la barra de herramientas ---
      handleColorChange = (e: Event) => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        const customEvent = e as CustomEvent;
        const activeObjects = canvas.getActiveObjects();
        if (!activeObjects || activeObjects.length === 0) return;

        const color = customEvent.detail?.color;
        if (!color) return;

        activeObjects.forEach((obj: any) => {
          if (obj.set) {
            if (obj.type === 'line') {
              obj.set({ stroke: color });
            } else {
              obj.set({ fill: color });
            }
          }
        });

        canvas.requestRenderAll();
        saveState();
      };

      handleFontChange = async (e: Event) => {
        if (!fabricCanvasRef.current) return;
        const customEvent = e as CustomEvent;
        const { fontFamily } = customEvent.detail || {};
        if (!fontFamily) return;

        const activeObject = fabricCanvasRef.current.getActiveObject();
        if (!activeObject || (activeObject.type !== 'i-text' && activeObject.type !== 'text')) return;

        // Cargar el stylesheet de Google Fonts
        loadGoogleFont(fontFamily);

        // Esperar a que el navegador cargue la fuente antes de aplicarla
        try {
          await document.fonts.load(`16px "${fontFamily}"`);
          activeObject.set('fontFamily', fontFamily);
          fabricCanvasRef.current.renderAll();
          saveState();
        } catch (err) {
          console.warn('Error al cargar la fuente:', fontFamily, err);
          // Aplicar de todas formas incluso si falla la precarga
          activeObject.set('fontFamily', fontFamily);
          fabricCanvasRef.current.renderAll();
        }
      };

      handleFontSizeChange = (e: Event) => {
        const customEvent = e as CustomEvent;
        const detail = customEvent?.detail || {};
        const fontSize = detail.fontSize;
        
        if (!fontSize) return;
        
        const activeObject = fabricCanvasRef.current?.getActiveObject();
        if (activeObject && (activeObject.type === 'i-text' || activeObject.type === 'text')) {
          activeObject.set('fontSize', fontSize);
          fabricCanvasRef.current.renderAll();
          saveState();
        }
      };

      // Listener para agregar texto vía CustomEvent
      handleAddText = (e: Event) => {
        if (!fabricCanvasRef.current) return;
        const customEvent = e as CustomEvent;
        const { text, fontSize, fontWeight } = customEvent.detail || {};

        const newText = new fabric.IText(text || 'Texto', {
          left: 100,
          top: 100,
          fontSize: fontSize || 24,
          fontWeight: fontWeight || 'normal',
          fill: '#1e293b',
          editable: true,
          selectable: true,
        });

        fabricCanvasRef.current.add(newText);
        fabricCanvasRef.current.centerObject(newText);
        fabricCanvasRef.current.setActiveObject(newText);
        fabricCanvasRef.current.renderAll();
      };

      // Listener para agregar imagen vía CustomEvent
      handleAddImage = (e: Event) => {
        if (!fabricCanvasRef.current) return;
        const customEvent = e as CustomEvent<{ dataUrl: string }>;
        const { dataUrl } = customEvent.detail || {};
        if (!dataUrl) return;

        // Crear un elemento img HTML oculto para precargar la imagen Base64
        const imgElement = document.createElement('img');
        imgElement.src = dataUrl;

        imgElement.onload = () => {
          // Una vez cargada en el HTML, crear el objeto de Fabric
          const fabricImage = new fabric.Image(imgElement, {
            left: 100,
            top: 100,
            cornerStyle: 'circle',
            transparentCorners: false,
          });

          // Escalar si es muy grande
          if (fabricImage.width && fabricImage.width > 300) {
            fabricImage.scaleToWidth(300);
          }

          fabricCanvasRef.current.add(fabricImage);
          fabricCanvasRef.current.centerObject(fabricImage);
          fabricCanvasRef.current.setActiveObject(fabricImage);
          fabricCanvasRef.current.renderAll();
        };
      };
      // Listener para cambiar de producto
      handleSwitchProduct = (e: Event) => {
        const customEvent = e as CustomEvent<{ product: ProductConfig }>;
        const newProduct = customEvent.detail.product;
        if (newProduct) {
          setupProduct(newProduct);
        }
      };

      // --- Listeners para manipulación de objetos ---
      handleDelete = () => {
        if (!fabricCanvasRef.current) return;
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length > 0) {
          isUpdatingHistory.current = true;
          activeObjects.forEach((obj: any) => canvas.remove(obj));
          canvas.discardActiveObject();
          canvas.requestRenderAll();
          setTimeout(() => {
            isUpdatingHistory.current = false;
            saveState();
          }, 0);
        }
      };

      handleDuplicate = () => {
        if (!fabricCanvasRef.current) return;
        const activeObject = canvas.getActiveObject();
        if (!activeObject) return;
        
        activeObject.clone((clonedObj: any) => {
          canvas.discardActiveObject();
          clonedObj.set({
            left: clonedObj.left + 20,
            top: clonedObj.top + 20,
            evented: true,
          });
          canvas.add(clonedObj);
          canvas.setActiveObject(clonedObj);
          canvas.requestRenderAll();
          saveState();
        });
      };

      handleBringForward = () => {
        const activeObject = fabricCanvasRef.current?.getActiveObject();
        if (activeObject) {
          fabricCanvasRef.current.bringToFront(activeObject);
          fabricCanvasRef.current.renderAll();
        }
      };

      handleSendBackward = () => {
        const activeObject = fabricCanvasRef.current?.getActiveObject();
        if (activeObject) {
          fabricCanvasRef.current.sendToBack(activeObject);
          // Re-traer la zona segura al frente para que siempre sea visible
          if (safeZoneRef.current) {
            fabricCanvasRef.current.bringToFront(safeZoneRef.current);
          }
          fabricCanvasRef.current.renderAll();
        }
      };

      // Listener para limpiar el canvas
      handleClear = () => {
        if (!fabricCanvasRef.current) return;
        const objects = fabricCanvasRef.current.getObjects();
        // No eliminar la zona segura
        const userObjects = objects.filter((obj: any) => obj !== safeZoneRef.current);
        userObjects.forEach((obj: any) => fabricCanvasRef.current.remove(obj));
        fabricCanvasRef.current.discardActiveObject();
        fabricCanvasRef.current.renderAll();
        saveState();
      };

      const restoreUserObjects = (jsonString: string) => {
        if (!fabricCanvasRef.current || !jsonString) return;
        const canvas = fabricCanvasRef.current;

        // 1. Remove only user objects
        const userObjects = canvas.getObjects().filter((obj: any) => !obj.isGuide);
        userObjects.forEach((obj: any) => canvas.remove(obj));

        // 2. Enliven and add new objects
        const objectsToLoad = JSON.parse(jsonString);
        // @ts-ignore Fabric.js types mismatch
        fabric.util.enlivenObjects(objectsToLoad, (enlivenedObjects: fabric.Object[]) => {
          enlivenedObjects.forEach((obj) => {
            canvas.add(obj);
          });
          canvas.renderAll();
          // Reset flag after render
          setTimeout(() => {
            isRedoingUndoRef.current = false;
          }, 0);
        });
      };

      handleUndo = () => {
        if (historyRef.current.length <= 1) return;
        isRedoingUndoRef.current = true;

        const current = historyRef.current.pop();
        if (current) {
          redoStackRef.current.push(current);
        }

        const previousState = historyRef.current[historyRef.current.length - 1];
        restoreUserObjects(previousState);
        updateHistoryButtons();
      };

      handleRedo = () => {
        if (redoStackRef.current.length === 0) return;
        isRedoingUndoRef.current = true;

        const nextState = redoStackRef.current.pop();
        if (nextState) {
          historyRef.current.push(nextState);
          restoreUserObjects(nextState);
          updateHistoryButtons();
        }
      };


      // Soporte para teclado
      handleKeyDown = (e: KeyboardEvent) => {
        const activeObject = fabricCanvasRef.current?.getActiveObject();
        if (activeObject && (activeObject as any).isEditing) return;

        if (e.key === 'Delete' || e.key === 'Backspace') {
          handleDelete();
        }
        
        // Keyboard shortcuts for undo/redo
        if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          handleUndo();
        }
        
        if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
          e.preventDefault();
          handleRedo();
        }
      };

      // Listener para agregar formas geométricas
      handleAddShape = (e: any) => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        const { type } = e.detail || {};
        if (!type) return;

        import('fabric').then((fabricModule) => {
          const fabric = fabricModule.fabric || fabricModule;
          let shape: any = null;

          const defaultProps = {
            left: canvas.width / 2 - 50,
            top: canvas.height / 2 - 50,
            fill: '#1E293B',
            strokeWidth: 0,
            cornerStyle: 'circle' as const,
            transparentCorners: false,
          };

          if (type === 'rect') {
            shape = new fabric.Rect({ ...defaultProps, width: 100, height: 100 });
          } else if (type === 'circle') {
            shape = new fabric.Circle({ ...defaultProps, radius: 50 });
          } else if (type === 'triangle') {
            shape = new fabric.Triangle({ ...defaultProps, width: 100, height: 100 });
          } else if (type === 'star') {
            // Polígono de 5 puntas para la estrella
            const points = [
              { x: 50, y: 0 }, { x: 63, y: 38 }, { x: 100, y: 38 },
              { x: 69, y: 59 }, { x: 82, y: 100 }, { x: 50, y: 75 },
              { x: 18, y: 100 }, { x: 31, y: 59 }, { x: 0, y: 38 }, { x: 37, y: 38 }
            ];
            shape = new fabric.Polygon(points, { ...defaultProps });
          } else if (type === 'heart') {
            const pathData = "M 272.7 51.2 C 226.4 13.7 153.2 27 118 77 C 82.7 27 9.5 13.7 -36.7 51.2 C -96.7 100 -80 180 118 320 C 316 180 332.7 100 272.7 51.2 Z";
            shape = new fabric.Path(pathData, { ...defaultProps, scaleX: 0.3, scaleY: 0.3 });
          }

          if (shape) {
            canvas.add(shape);
            canvas.setActiveObject(shape);
            canvas.requestRenderAll();

            // Notificar que hay un objeto seleccionado para activar botones de eliminar/duplicar
            window.dispatchEvent(new CustomEvent('editor:selection-changed', {
              detail: { selectedObject: shape }
            }));

            if (typeof saveState === 'function') saveState();
          }
        });
      };

      window.addEventListener('editor:add-text', handleAddText);
      window.addEventListener('editor:change-color', handleColorChange);
      window.addEventListener('editor:change-font', handleFontChange);
      window.addEventListener('editor:change-fontSize', handleFontSizeChange);
      window.addEventListener('editor:add-image', handleAddImage);
      window.addEventListener('editor:switch-product', handleSwitchProduct);
      window.addEventListener('editor:delete-active', handleDelete);
      window.addEventListener('editor:clear-canvas', handleClear);
      window.addEventListener('editor:duplicate-active', handleDuplicate);
      window.addEventListener('editor:bring-forward', handleBringForward);
      window.addEventListener('editor:send-backward', handleSendBackward);
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('editor:add-shape', handleAddShape);
      window.addEventListener('editor:undo', handleUndo);
      window.addEventListener('editor:redo', handleRedo);

      canvas.on('object:added', saveState);
      canvas.on('object:modified', saveState);
      canvas.on('object:removed', saveState);
    });

    return () => {
      isMounted = false;
      if (handleAddText) {
        window.removeEventListener('editor:add-text', handleAddText);
      }
      if (handleColorChange) {
        window.removeEventListener('editor:change-color', handleColorChange);
      }
      if (handleFontChange) {
        window.removeEventListener('editor:change-font', handleFontChange);
      }
      if (handleFontSizeChange) {
        window.removeEventListener('editor:change-fontSize', handleFontSizeChange);
      }
      if (handleAddImage) {
        window.removeEventListener('editor:add-image', handleAddImage);
      }
      if (handleSwitchProduct) {
        window.removeEventListener('editor:switch-product', handleSwitchProduct);
      }
      if (handleDelete) {
        window.removeEventListener('editor:delete-active', handleDelete);
        window.removeEventListener('keydown', handleKeyDown);
      }
      if (handleDuplicate) window.removeEventListener('editor:duplicate-active', handleDuplicate);
      if (handleBringForward) window.removeEventListener('editor:bring-forward', handleBringForward);
      if (handleSendBackward) {
        window.removeEventListener('editor:send-backward', handleSendBackward);
      }
      if (handleClear) {
        window.removeEventListener('editor:clear-canvas', handleClear);
      }
      if (handleUndo) {
        window.removeEventListener('editor:undo', handleUndo);
      }
      if (handleRedo) {
        window.removeEventListener('editor:redo', handleRedo);
      }
      if (handleAddShape) {
        window.removeEventListener('editor:add-shape', handleAddShape);
      }
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[32px] border border-slate-200 bg-[#F4F5F7] p-0 shadow-sm">
      <div className="overflow-hidden rounded-md shadow-inner">
        <canvas ref={canvasRef} width={initialProduct.canvasWidth} height={initialProduct.canvasHeight} />
      </div>
    </div>
  );
}