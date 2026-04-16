import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Stage, Layer, Image as KonvaImage, Line, Rect, Ellipse, Text, Arrow, Transformer, Group, Circle as KonvaCircle, Star } from 'react-konva';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Survey, CanvasObject } from '../types';
import { 
  ArrowLeft, 
  Save, 
  Download, 
  Type, 
  Square, 
  Circle as CircleIcon, 
  Minus, 
  MousePointer2, 
  Trash2, 
  Layers, 
  Camera,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  Pen,
  StickyNote,
  X,
  RotateCcw,
  RotateCw,
  Maximize2,
  Move,
  Combine,
  Split,
  FileCode,
  Ruler,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Magnet,
  Hexagon,
  Star as StarIcon
} from 'lucide-react';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import useImage from 'use-image';
import { PDFDocument, rgb, degrees } from 'pdf-lib';

export function SurveyCanvas() {
  const { projectId, surveyId } = useParams();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [objects, setObjects] = useState<CanvasObject[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tool, setTool] = useState<'select' | 'line' | 'rect' | 'ellipse' | 'text' | 'arrow' | 'sticky' | 'pen' | 'measure' | 'polygon' | 'star' | 'angle' | 'icon'>('select');
  const [history, setHistory] = useState<CanvasObject[][]>([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const [bgImage] = useImage(survey?.mediaUrl || '');
  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [scale, setScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(() => localStorage.getItem('showGrid') !== 'false');
  const [isSaving, setIsSaving] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(() => localStorage.getItem('snapToGrid') !== 'false');
  const [gridSize, setGridSize] = useState(() => parseInt(localStorage.getItem('gridSize') || '50'));
  const [defaultUnit, setDefaultUnit] = useState<'cm' | 'mm' | 'm'>('cm');
  const [layers, setLayers] = useState<{id: string, name: string, visible: boolean}[]>([{id: 'default', name: 'Varsayılan', visible: true}]);
  const [clipboard, setClipboard] = useState<CanvasObject[]>([]);
  
  const stageRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);

  useEffect(() => {
    localStorage.setItem('showGrid', showGrid.toString());
    localStorage.setItem('snapToGrid', snapToGrid.toString());
    localStorage.setItem('gridSize', gridSize.toString());
  }, [showGrid, snapToGrid, gridSize]);

  useEffect(() => {
    if (!projectId || !surveyId) return;

    const unsubscribe = onSnapshot(doc(db, 'projects', projectId, 'surveys', surveyId), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as Survey;
        setSurvey({ id: doc.id, ...data });
        if (data.canvasData) {
          try {
            setObjects(JSON.parse(data.canvasData));
          } catch (e) {
            console.error("Error parsing canvas data", e);
          }
        }
      }
    });

    const handleResize = () => {
      setStageSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      unsubscribe();
      window.removeEventListener('resize', handleResize);
    };
  }, [projectId, surveyId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const isCtrl = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDelete();
      }

      // Undo (Ctrl+Z)
      if (isCtrl && e.key === 'z' && !isShift) {
        e.preventDefault();
        undo();
      }

      // Redo (Ctrl+Y or Ctrl+Shift+Z)
      if (isCtrl && (e.key === 'y' || (e.key === 'z' && isShift))) {
        e.preventDefault();
        redo();
      }

      // Copy (Ctrl+C)
      if (isCtrl && e.key === 'c') {
        e.preventDefault();
        if (selectedIds.length > 0) {
          const selectedObjects = objects.filter(obj => selectedIds.includes(obj.id));
          setClipboard(selectedObjects);
        }
      }

      // Paste (Ctrl+V)
      if (isCtrl && e.key === 'v') {
        e.preventDefault();
        if (clipboard.length > 0) {
          const offset = 20;
          const newObjects = clipboard.map(obj => ({
            ...obj,
            id: `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            x: obj.x + offset,
            y: obj.y + offset,
          }));
          setObjects([...objects, ...newObjects]);
          setSelectedIds(newObjects.map(o => o.id));
        }
      }

      // Select All (Ctrl+A)
      if (isCtrl && e.key === 'a') {
        e.preventDefault();
        setSelectedIds(objects.map(o => o.id));
      }

      // Duplicate (Ctrl+D)
      if (isCtrl && e.key === 'd') {
        e.preventDefault();
        if (selectedIds.length > 0) {
          const selectedObjects = objects.filter(obj => selectedIds.includes(obj.id));
          const offset = 20;
          const newObjects = selectedObjects.map(obj => ({
            ...obj,
            id: `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            x: obj.x + offset,
            y: obj.y + offset,
          }));
          setObjects([...objects, ...newObjects]);
          setSelectedIds(newObjects.map(o => o.id));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [objects, selectedIds, clipboard, historyStep, history]);

  useEffect(() => {
    if (selectedIds.length > 0 && transformerRef.current) {
      const nodes = selectedIds.map(id => stageRef.current.findOne('#' + id)).filter(Boolean);
      transformerRef.current.nodes(nodes);
      transformerRef.current.getLayer().batchDraw();
    }
  }, [selectedIds]);

  useEffect(() => {
    if (objects.length > 0 && historyStep === history.length - 1) {
      setHistory([...history, objects]);
      setHistoryStep(history.length);
    }
  }, [objects]);

  useEffect(() => {
    if (!projectId || !surveyId) return;

    const saveChanges = async () => {
      setIsSaving(true);
      try {
        await updateDoc(doc(db, 'projects', projectId, 'surveys', surveyId), {
          canvasData: JSON.stringify(objects)
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}/surveys/${surveyId}`);
      } finally {
        setIsSaving(false);
      }
    };

    const saveTimeout = setTimeout(saveChanges, 30000);

    window.addEventListener('beforeunload', saveChanges);

    return () => {
      clearTimeout(saveTimeout);
      window.removeEventListener('beforeunload', saveChanges);
    };
  }, [objects, projectId, surveyId]);

  const undo = () => {
    if (historyStep > 0) {
      setHistoryStep(historyStep - 1);
      setObjects(history[historyStep - 1]);
    }
  };

  const redo = () => {
    if (historyStep < history.length - 1) {
      setHistoryStep(historyStep + 1);
      setObjects(history[historyStep + 1]);
    }
  };

  const handleMouseDown = (e: any) => {
    const clickedOnEmpty = e.target === e.target.getStage();
    
    if (tool === 'select') {
      if (clickedOnEmpty) {
        setSelectedIds([]);
        return;
      }

      const id = e.target.id();
      const obj = objects.find(o => o.id === id);
      
      if (obj) {
        if (obj.isLocked) return;
        const isShift = e.evt.shiftKey;
        let newSelectedIds = [...selectedIds];

        if (isShift) {
          if (newSelectedIds.includes(id)) {
            newSelectedIds = newSelectedIds.filter(sid => sid !== id);
          } else {
            newSelectedIds.push(id);
          }
        } else {
          if (!newSelectedIds.includes(id)) {
            newSelectedIds = [id];
          }
        }

        // If any selected object is in a group, select the whole group
        const groupIds = objects
          .filter(o => newSelectedIds.includes(o.id) && o.groupId)
          .map(o => o.groupId);
        
        if (groupIds.length > 0) {
          const allInGroups = objects
            .filter(o => o.groupId && groupIds.includes(o.groupId))
            .map(o => o.id);
          newSelectedIds = Array.from(new Set([...newSelectedIds, ...allInGroups]));
        }

        setSelectedIds(newSelectedIds);
      }
      return;
    }

    if (clickedOnEmpty) {
      setIsDrawing(true);
      const stage = e.target.getStage();
      const pos = stage.getRelativePointerPosition();
      
      let finalX = pos.x;
      let finalY = pos.y;

      if (snapToGrid) {
        finalX = Math.round(pos.x / gridSize) * gridSize;
        finalY = Math.round(pos.y / gridSize) * gridSize;
      }

      const newId = `obj-${Date.now()}`;
      const newObj: CanvasObject = {
        id: newId,
        type: tool,
        x: finalX,
        y: finalY,
        stroke: tool === 'sticky' ? '#000000' : '#6366F1',
        strokeWidth: tool === 'pen' ? 3 : 2,
        fill: tool === 'sticky' ? '#FFFF88' : (tool === 'text' ? '#ffffff' : 'transparent'),
        text: tool === 'sticky' ? 'Notunuzu buraya yazın' : (tool === 'text' ? 'Not ekleyin' : ''),
        unit: defaultUnit,
      };

      if (tool === 'line' || tool === 'arrow' || tool === 'pen' || tool === 'measure' || tool === 'polygon' || tool === 'star' || tool === 'angle') {
        newObj.points = [0, 0, 0, 0];
      } else if (tool === 'rect' || tool === 'ellipse' || tool === 'sticky') {
        newObj.width = 0;
        newObj.height = 0;
      }

      setObjects([...objects, newObj]);
      setSelectedIds([newId]);
    }
  };

  const handleMouseMove = (e: any) => {
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    setMousePos(pointer);

    if (tool === 'select' || selectedIds.length !== 1) return;

    const pos = stage.getRelativePointerPosition();
    const isShift = e.evt.shiftKey;

    let finalX = pos.x;
    let finalY = pos.y;

    if (snapToGrid) {
      finalX = Math.round(pos.x / gridSize) * gridSize;
      finalY = Math.round(pos.y / gridSize) * gridSize;
    }

    const updatedObjects = objects.map((obj) => {
      if (obj.id === selectedIds[0]) {
        if (obj.isLocked) return obj;
        
        if (obj.type === 'line' || obj.type === 'arrow' || obj.type === 'measure' || obj.type === 'polygon' || obj.type === 'star' || obj.type === 'angle') {
          let dx = finalX - obj.x;
          let dy = finalY - obj.y;

          // Snap to 45/90 degrees if shift is held
          if (isShift) {
            const angle = Math.atan2(dy, dx);
            const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
            const dist = Math.sqrt(dx * dx + dy * dy);
            dx = dist * Math.cos(snappedAngle);
            dy = dist * Math.sin(snappedAngle);
          }

          const dist = Math.sqrt(dx * dx + dy * dy);
          const pixelsPerUnit = survey?.pixelsPerUnit || 1;
          const displayVal = survey?.pixelsPerUnit ? (dist / pixelsPerUnit).toFixed(1) : Math.round(dist).toString();
          
          return { 
            ...obj, 
            points: [0, 0, dx, dy],
            realMeasurement: obj.type === 'measure' ? displayVal : obj.realMeasurement
          };
        } else if (obj.type === 'pen') {
          return { ...obj, points: [...(obj.points || []), finalX - obj.x, finalY - obj.y] };
        } else if (obj.type === 'rect' || obj.type === 'ellipse' || obj.type === 'sticky') {
          return { ...obj, width: finalX - obj.x, height: finalY - obj.y };
        }
      }
      return obj;
    });
    setObjects(updatedObjects);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    if (tool !== 'select') {
      setTool('select');
    }
  };

  const handleSave = async () => {
    if (!projectId || !surveyId) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'projects', projectId, 'surveys', surveyId), {
        canvasData: JSON.stringify(objects),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}/surveys/${surveyId}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (selectedIds.length > 0) {
      setObjects(objects.filter(obj => !selectedIds.includes(obj.id)));
      setSelectedIds([]);
    }
  };

  const handleGroup = () => {
    if (selectedIds.length < 2) return;
    const groupId = `group-${Date.now()}`;
    const updated = objects.map(obj => 
      selectedIds.includes(obj.id) ? { ...obj, groupId } : obj
    );
    setObjects(updated);
  };

  const handleUngroup = () => {
    if (selectedIds.length === 0) return;
    const updated = objects.map(obj => 
      selectedIds.includes(obj.id) ? { ...obj, groupId: undefined } : obj
    );
    setObjects(updated);
  };

  const handleMoveZ = (direction: 'up' | 'down' | 'front' | 'back') => {
    const newObjects = [...objects];
    selectedIds.forEach(id => {
      const index = newObjects.findIndex(o => o.id === id);
      if (index === -1) return;
      
      if (direction === 'up' && index < newObjects.length - 1) {
        [newObjects[index], newObjects[index + 1]] = [newObjects[index + 1], newObjects[index]];
      } else if (direction === 'down' && index > 0) {
        [newObjects[index], newObjects[index - 1]] = [newObjects[index - 1], newObjects[index]];
      } else if (direction === 'front') {
        const obj = newObjects.splice(index, 1)[0];
        newObjects.push(obj);
      } else if (direction === 'back') {
        const obj = newObjects.splice(index, 1)[0];
        newObjects.unshift(obj);
      }
    });
    setObjects(newObjects);
  };

  const handleAlign = (alignment: 'left' | 'right' | 'center' | 'top' | 'bottom' | 'middle') => {
    if (selectedIds.length < 2) return;
    const selectedObjects = objects.filter(o => selectedIds.includes(o.id));
    
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    selectedObjects.forEach(o => {
      minX = Math.min(minX, o.x);
      maxX = Math.max(maxX, o.x + (o.width || 0));
      minY = Math.min(minY, o.y);
      maxY = Math.max(maxY, o.y + (o.height || 0));
    });

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setObjects(objects.map(o => {
      if (!selectedIds.includes(o.id)) return o;
      let { x, y } = o;
      if (alignment === 'left') x = minX;
      else if (alignment === 'right') x = maxX - (o.width || 0);
      else if (alignment === 'center') x = centerX - (o.width || 0) / 2;
      else if (alignment === 'top') y = minY;
      else if (alignment === 'bottom') y = maxY - (o.height || 0);
      else if (alignment === 'middle') y = centerY - (o.height || 0) / 2;
      return { ...o, x, y };
    }));
  };

  const deleteLayer = (layerId: string) => {
    if (layerId === 'default') return;
    setLayers(layers.filter(l => l.id !== layerId));
    setObjects(objects.map(o => o.layer === layerId ? { ...o, layer: 'default' } : o));
  };

  const toggleLock = () => {
    setObjects(objects.map(o => 
      selectedIds.includes(o.id) ? { ...o, isLocked: !o.isLocked } : o
    ));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result && survey) {
          setSurvey({ ...survey, mediaUrl: event.target.result as string });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTransformEnd = (e: any) => {
    const nodes = transformerRef.current.nodes();
    const updated = objects.map(obj => {
      const node = nodes.find((n: any) => n.id() === obj.id);
      if (node) {
        return {
          ...obj,
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          scaleX: node.scaleX(),
          scaleY: node.scaleY(),
          width: node.width(),
          height: node.height(),
        };
      }
      return obj;
    });
    setObjects(updated);
  };

  const handleSetReference = async () => {
    if (selectedIds.length !== 1 || !projectId || !surveyId) return;
    const obj = objects.find(o => o.id === selectedIds[0]);
    if (!obj || obj.type !== 'measure') return;

    const dx = (obj.points?.[2] || 0);
    const dy = (obj.points?.[3] || 0);
    const pixelDist = Math.sqrt(dx * dx + dy * dy);
    const realVal = parseFloat(obj.realMeasurement || '0');

    if (realVal > 0) {
      const pixelsPerUnit = pixelDist / realVal;
      try {
        await updateDoc(doc(db, 'projects', projectId, 'surveys', surveyId), {
          pixelsPerUnit,
          referenceUnit: obj.unit || 'cm'
        });
        
        // Update local objects to mark the reference and recalculate other measurements
        setObjects(objects.map(o => {
          if (o.id === obj.id) {
            return { ...o, isReference: true };
          }
          if (o.type === 'measure' && o.points) {
            const dx = o.points[2] || 0;
            const dy = o.points[3] || 0;
            const dist = Math.sqrt(dx * dx + dy * dy);
            return {
              ...o,
              isReference: false,
              realMeasurement: (dist / pixelsPerUnit).toFixed(1)
            };
          }
          return { ...o, isReference: false };
        }));
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}/surveys/${surveyId}`);
      }
    }
  };

  const exportSVG = () => {
    const stage = stageRef.current;
    if (!stage) return;

    const width = stageSize.width;
    const height = stageSize.height;
    
    let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
    
    // Add background color
    svg += `<rect width="100%" height="100%" fill="#0a0a0a" />`;

    // Add grid if visible
    if (showGrid) {
      for (let i = -150; i < 150; i++) {
        for (let j = -150; j < 150; j++) {
          svg += `<circle cx="${i * gridSize + stagePos.x}" cy="${j * gridSize + stagePos.y}" r="${0.5 * scale}" fill="rgba(255,255,255,0.05)" />`;
        }
      }
    }

    // Add objects
    const objectsToExport = selectedIds.length > 0 ? objects.filter(o => selectedIds.includes(o.id)) : objects;
    objectsToExport.forEach(obj => {
      const x = obj.x * scale + stagePos.x;
      const y = obj.y * scale + stagePos.y;
      const rotation = obj.rotation || 0;
      const scaleX = obj.scaleX || 1;
      const scaleY = obj.scaleY || 1;
      const stroke = obj.stroke || '#6366F1';
      const strokeWidth = (obj.strokeWidth || 2);
      const fill = obj.fill || 'none';

      let transform = `translate(${x}, ${y}) rotate(${rotation}) scale(${scaleX}, ${scaleY})`;

      if (obj.type === 'rect' || obj.type === 'sticky') {
        const w = (obj.width || 0) * scale;
        const h = (obj.height || 0) * scale;
        svg += `<rect width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" rx="${obj.type === 'sticky' ? 4 : 0}" transform="${transform}" />`;
        if (obj.type === 'sticky' && obj.text) {
          svg += `<text x="${w/2}" y="${h/2}" fill="#000000" font-size="${14 * scale}" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle" font-weight="bold" transform="${transform}">${obj.text}</text>`;
        }
      } else if (obj.type === 'ellipse') {
        const rx = Math.abs((obj.width || 0) / 2) * scale;
        const ry = Math.abs((obj.height || 0) / 2) * scale;
        svg += `<ellipse cx="0" cy="0" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" transform="${transform}" />`;
      } else if (obj.type === 'line' || obj.type === 'pen' || obj.type === 'arrow') {
        const points = obj.points || [];
        let d = `M ${points[0] * scale} ${points[1] * scale}`;
        for (let i = 2; i < points.length; i += 2) {
          d += ` L ${points[i] * scale} ${points[i+1] * scale}`;
        }
        svg += `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" transform="${transform}" />`;
        
        if (obj.type === 'arrow') {
          // Better arrow head for SVG
          const lastX = points[points.length - 2] * scale;
          const lastY = points[points.length - 1] * scale;
          const prevX = points[points.length - 4] * scale;
          const prevY = points[points.length - 3] * scale;
          const angle = Math.atan2(lastY - prevY, lastX - prevX);
          const headLen = 10 * scale;
          
          svg += `<path d="M ${lastX} ${lastY} L ${lastX - headLen * Math.cos(angle - Math.PI / 6)} ${lastY - headLen * Math.sin(angle - Math.PI / 6)} M ${lastX} ${lastY} L ${lastX - headLen * Math.cos(angle + Math.PI / 6)} ${lastY - headLen * Math.sin(angle + Math.PI / 6)}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" transform="${transform}" />`;
        }
      } else if (obj.type === 'measure') {
        const points = obj.points || [0, 0, 0, 0];
        const x2 = points[2] * scale;
        const y2 = points[3] * scale;
        const midX = x2 / 2;
        const midY = y2 / 2;
        const angle = Math.atan2(y2, x2) * (180 / Math.PI);
        
        const isRef = obj.isReference;
        const strokeColor = isRef ? '#00FF00' : stroke;
        
        svg += `<g transform="${transform}">`;
        svg += `<line x1="0" y1="0" x2="${x2}" y2="${y2}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />`;
        svg += `<line x1="0" y1="${-10 * scale}" x2="0" y2="${10 * scale}" stroke="${strokeColor}" stroke-width="${strokeWidth}" transform="rotate(${angle + 90})" />`;
        svg += `<line x1="0" y1="${-10 * scale}" x2="0" y2="${10 * scale}" stroke="${strokeColor}" stroke-width="${strokeWidth}" transform="translate(${x2}, ${y2}) rotate(${angle + 90})" />`;
        const labelWidth = isRef ? 80 * scale : 60 * scale;
        svg += `<g transform="translate(${midX}, ${midY}) rotate(${angle})">`;
        svg += `<rect x="${-labelWidth / 2}" y="${-10 * scale}" width="${labelWidth}" height="${20 * scale}" fill="${isRef ? '#00FF00' : '#1a1a1a'}" rx="${4 * scale}" />`;
        svg += `<text x="0" y="0" fill="${isRef ? '#000000' : '#ffffff'}" font-size="${12 * scale}" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle" font-weight="bold">${isRef ? 'REF: ' : ''}${obj.realMeasurement} ${obj.unit || 'cm'}</text>`;
        svg += `</g></g>`;
      } else if (obj.type === 'text') {
        svg += `<text x="0" y="0" fill="${stroke}" font-size="${20 * scale}" font-family="sans-serif" transform="${transform}">${obj.text}</text>`;
      }

      // Add measurement label if exists
      if (obj.realMeasurement) {
        svg += `<text x="${x}" y="${y - 10 * scale}" fill="#ffffff" font-size="${10 * scale}" font-family="sans-serif" font-weight="bold">${obj.realMeasurement} ${obj.unit || 'cm'}</text>`;
      }
    });

    svg += `</svg>`;
    
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${survey?.title || 'kesif'}.svg`;
    link.click();
  };

  const exportImage = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const dataURL = stage.toDataURL({ pixelRatio: 2 });
    const link = document.createElement('a');
    link.download = `${survey?.title || 'kesif'}.png`;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = async () => {
    if (!stageRef.current) return;
    
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([stageSize.width, stageSize.height]);
    
    // Draw background
    page.drawRectangle({
      x: 0,
      y: 0,
      width: stageSize.width,
      height: stageSize.height,
      color: rgb(0.04, 0.04, 0.04),
    });

    // Helper to convert hex to rgb
    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      return rgb(r, g, b);
    };

    // Draw objects as vectors
    const objectsToExport = selectedIds.length > 0 ? objects.filter(o => selectedIds.includes(o.id)) : objects;
    objectsToExport.forEach(obj => {
      const x = obj.x * scale + stagePos.x;
      const y = stageSize.height - (obj.y * scale + stagePos.y); // PDF coordinate system is bottom-up
      const rotation = obj.rotation || 0;
      const scaleX = obj.scaleX || 1;
      const scaleY = obj.scaleY || 1;
      const stroke = hexToRgb(obj.stroke || '#6366F1');
      const strokeWidth = (obj.strokeWidth || 2);
      const fill = obj.fill && obj.fill !== 'transparent' ? hexToRgb(obj.fill) : undefined;

      if (obj.type === 'rect' || obj.type === 'sticky') {
        const w = (obj.width || 0) * scale * scaleX;
        const h = (obj.height || 0) * scale * scaleY;
        page.drawRectangle({
          x,
          y: y - h,
          width: w,
          height: h,
          borderColor: stroke,
          borderWidth: strokeWidth,
          color: fill,
          rotate: degrees(-rotation), // PDF rotation is counter-clockwise
        });
        if (obj.type === 'sticky' && obj.text) {
          page.drawText(obj.text, {
            x: x + 5,
            y: y - h/2,
            size: 12 * scale,
            color: rgb(0, 0, 0),
            rotate: degrees(-rotation),
          });
        }
      } else if (obj.type === 'ellipse') {
        const rx = Math.abs((obj.width || 0) / 2) * scale * scaleX;
        const ry = Math.abs((obj.height || 0) / 2) * scale * scaleY;
        page.drawEllipse({
          x,
          y,
          xScale: rx,
          yScale: ry,
          borderColor: stroke,
          borderWidth: strokeWidth,
          color: fill,
          rotate: degrees(-rotation),
        });
      } else if (obj.type === 'line' || obj.type === 'pen' || obj.type === 'arrow') {
        const points = obj.points || [];
        // For lines, we need to apply rotation manually if we want to be precise, 
        // but pdf-lib doesn't have a simple 'rotate' for drawLine that works like Konva.
        // However, we can use the fact that points are relative to x,y.
        const rad = (-rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        for (let i = 0; i < points.length - 2; i += 2) {
          const px1 = points[i] * scale * scaleX;
          const py1 = points[i+1] * scale * scaleY;
          const px2 = points[i+2] * scale * scaleX;
          const py2 = points[i+3] * scale * scaleY;

          // Rotate points
          const rx1 = px1 * cos - py1 * sin;
          const ry1 = px1 * sin + py1 * cos;
          const rx2 = px2 * cos - py2 * sin;
          const ry2 = px2 * sin + py2 * cos;

          page.drawLine({
            start: { x: x + rx1, y: y - ry1 },
            end: { x: x + rx2, y: y - ry2 },
            thickness: strokeWidth,
            color: stroke,
          });
        }
      } else if (obj.type === 'measure') {
        const points = obj.points || [0, 0, 0, 0];
        const x2 = points[2] * scale * scaleX;
        const y2 = points[3] * scale * scaleY;
        const midX = x2 / 2;
        const midY = y2 / 2;
        const angle = Math.atan2(y2, x2) * (180 / Math.PI);
        
        const isRef = obj.isReference;
        const pdfStroke = isRef ? rgb(0, 1, 0) : stroke;
        
        // Main line
        page.drawLine({
          start: { x, y },
          end: { x: x + x2, y: y - y2 },
          thickness: strokeWidth,
          color: pdfStroke,
        });
        
        // Perpendiculars
        const rad = (angle + 90) * (Math.PI / 180);
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const len = 10 * scale;
        
        page.drawLine({
          start: { x: x - len * cos, y: y + len * sin },
          end: { x: x + len * cos, y: y - len * sin },
          thickness: strokeWidth,
          color: pdfStroke,
        });
        
        page.drawLine({
          start: { x: x + x2 - len * cos, y: y - y2 + len * sin },
          end: { x: x + x2 + len * cos, y: y - y2 - len * sin },
          thickness: strokeWidth,
          color: pdfStroke,
        });
        
        const labelWidth = isRef ? 80 * scale : 60 * scale;
        // Label
        page.drawRectangle({
          x: x + midX - (labelWidth / 2),
          y: y - midY - 10 * scale,
          width: labelWidth,
          height: 20 * scale,
          color: isRef ? rgb(0, 1, 0) : rgb(0.1, 0.1, 0.1),
          rotate: degrees(-angle),
        });
        page.drawText(`${isRef ? 'REF: ' : ''}${obj.realMeasurement} ${obj.unit || 'cm'}`, {
          x: x + midX - (labelWidth / 2 - 5),
          y: y - midY - 5 * scale,
          size: 10 * scale,
          color: isRef ? rgb(0, 0, 0) : rgb(1, 1, 1),
          rotate: degrees(-angle),
        });
      } else if (obj.type === 'text') {
        page.drawText(obj.text || '', {
          x,
          y: y - 15 * scale,
          size: 18 * scale,
          color: stroke,
          rotate: degrees(-rotation),
        });
      }

      if (obj.realMeasurement) {
        page.drawText(`${obj.realMeasurement} ${obj.unit || 'cm'}`, {
          x,
          y: y + 5 * scale,
          size: 10 * scale,
          color: rgb(1, 1, 1),
          rotate: degrees(-rotation),
        });
      }
    });

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${survey?.title || 'kesif'}.pdf`;
    link.click();
  };

  const clearCanvas = () => {
    if (window.confirm('Tüm çizimleri silmek istediğinize emin misiniz?')) {
      setObjects([]);
      setSelectedIds([]);
    }
  };

  const zoomToFit = () => {
    if (objects.length === 0) {
      setScale(1);
      setStagePos({ x: 0, y: 0 });
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    objects.forEach(obj => {
      minX = Math.min(minX, obj.x);
      minY = Math.min(minY, obj.y);
      maxX = Math.max(maxX, obj.x + (obj.width || 0));
      maxY = Math.max(maxY, obj.y + (obj.height || 0));
    });

    const padding = 50;
    const contentWidth = maxX - minX + padding * 2;
    const contentHeight = maxY - minY + padding * 2;

    const scaleX = stageSize.width / contentWidth;
    const scaleY = stageSize.height / contentHeight;
    const newScale = Math.min(scaleX, scaleY, 2); // Cap at 2x zoom

    setScale(newScale);
    setStagePos({
      x: (stageSize.width - (maxX + minX) * newScale) / 2,
      y: (stageSize.height - (maxY + minY) * newScale) / 2,
    });
  };

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = stageRef.current;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    setMousePos(pointer);

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    setScale(newScale);

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    setStagePos(newPos);
  };

  // Grid background generation
  const gridDots = [];
  for (let i = -150; i < 150; i++) {
    for (let j = -150; j < 150; j++) {
      gridDots.push(<KonvaCircle key={`grid-${i}-${j}`} x={i * gridSize} y={j * gridSize} radius={0.5} fill="rgba(255,255,255,0.05)" listening={false} />);
    }
  }

  return (
    <div className="fixed inset-0 bg-[#050505] overflow-hidden font-sans relative">
      {/* Background Glows */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-[#6366F1]/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-[#6366F1]/3 rounded-full blur-[150px]" />
      </div>

      {/* Floating Header */}
      <header className="fixed top-6 left-1/2 -translate-x-1/2 h-14 bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl flex items-center justify-between px-6 z-50 shadow-2xl min-w-[500px]">
        <div className="flex items-center gap-4">
          <Link to={`/projects/${projectId}`} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex flex-col">
            <h1 className="text-sm font-bold tracking-tight leading-none">{survey?.title}</h1>
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-1">
              {survey?.type}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl mr-2 border border-white/5">
            <button onClick={undo} disabled={historyStep <= 0} className="p-2 hover:bg-white/10 rounded-lg disabled:opacity-20"><Undo className="w-4 h-4" /></button>
            <button onClick={redo} disabled={historyStep >= history.length - 1} className="p-2 hover:bg-white/10 rounded-lg disabled:opacity-20"><Redo className="w-4 h-4" /></button>
          </div>
          <select 
            value={defaultUnit} 
            onChange={(e) => setDefaultUnit(e.target.value as 'cm' | 'mm' | 'm')}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#6366F1] text-white"
          >
            <option value="cm">cm</option>
            <option value="mm">mm</option>
            <option value="m">m</option>
          </select>
          <div className="flex items-center gap-2 bg-white/5 p-2 rounded-xl border border-white/5">
            <button onClick={() => setShowGrid(!showGrid)} className={cn("p-2 rounded-lg", showGrid ? "bg-white/20" : "hover:bg-white/10")} title="Izgarayı Göster/Gizle"><Maximize2 className="w-4 h-4" /></button>
            <button onClick={() => setSnapToGrid(!snapToGrid)} className={cn("p-2 rounded-lg", snapToGrid ? "bg-white/20" : "hover:bg-white/10")} title="Izgaraya Yapıştır"><Magnet className="w-4 h-4" /></button>
            <button onClick={zoomToFit} className="p-2 hover:bg-white/10 rounded-lg" title="Sığdır"><Move className="w-4 h-4" /></button>
            <button onClick={clearCanvas} className="p-2 hover:bg-red-500/20 text-red-500 rounded-lg" title="Temizle"><Trash2 className="w-4 h-4" /></button>
            <div className="text-[10px] font-mono text-white/40 px-2 min-w-[40px] text-center">
              {Math.round(scale * 100)}%
            </div>
            <input 
              type="number" 
              value={gridSize} 
              onChange={(e) => setGridSize(parseInt(e.target.value) || 50)} 
              className="w-12 bg-transparent border-none focus:outline-none text-xs text-white"
              title="Izgara Boyutu"
            />
          </div>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 bg-[#6366F1] text-black text-xs font-bold px-4 py-2 rounded-xl hover:scale-105 transition-transform disabled:opacity-50 shadow-[0_5px_15px_rgba(99,102,241,0.3)]"
          >
            {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Kaydet
          </button>
          <button 
            onClick={exportImage}
            className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors border border-white/5"
            title="PNG Aktar"
          >
            <Camera className="w-4 h-4" />
          </button>
          <button 
            onClick={exportSVG}
            className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors border border-white/5"
            title="SVG Aktar"
          >
            <FileCode className="w-4 h-4" />
          </button>
          <button 
            onClick={exportPDF}
            className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors border border-white/5"
            title="PDF Aktar"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Calibration Info */}
      {survey?.pixelsPerUnit && (
        <div className="fixed top-24 left-8 bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl px-4 py-3 z-50 shadow-2xl flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#00FF00] animate-pulse shadow-[0_0_10px_#00FF00]" />
          <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">
            Ölçekli Çalışma Aktif: 1 {survey.referenceUnit || 'cm'} = {Math.round(survey.pixelsPerUnit)}px
          </span>
        </div>
      )}

      {/* Floating Tool Palette */}
      <aside className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl flex items-center p-2 gap-1 z-50 shadow-2xl">
        {[
          { id: 'select', icon: MousePointer2, label: 'Seç' },
          { id: 'pen', icon: Pen, label: 'Kalem' },
          { id: 'line', icon: Minus, label: 'Çizgi' },
          { id: 'arrow', icon: Move, label: 'Ok' },
          { id: 'measure', icon: Ruler, label: 'Ölçü' },
          { id: 'rect', icon: Square, label: 'Kutu' },
          { id: 'ellipse', icon: CircleIcon, label: 'Daire' },
          { id: 'sticky', icon: StickyNote, label: 'Not' },
          { id: 'text', icon: Type, label: 'Yazı' },
          { id: 'polygon', icon: Hexagon, label: 'Çokgen' },
          { id: 'star', icon: StarIcon, label: 'Yıldız' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id as any)}
            className={cn(
              "w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-1 transition-all",
              tool === t.id ? "bg-[#6366F1] text-black shadow-[0_5px_15px_rgba(99,102,241,0.3)]" : "text-white/40 hover:bg-white/5 hover:text-white"
            )}
            title={t.label}
          >
            <t.icon className="w-5 h-5" />
          </button>
        ))}
        <div className="w-px h-8 bg-white/10 mx-1" />
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
          <button 
            onClick={handleGroup}
            disabled={selectedIds.length < 2}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-20 transition-all"
            title="Grupla"
          >
            <Combine className="w-4 h-4" />
          </button>
          <button 
            onClick={handleUngroup}
            disabled={selectedIds.length === 0}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-20 transition-all"
            title="Grubu Çöz"
          >
            <Split className="w-4 h-4" />
          </button>
        </div>
        <div className="w-px h-8 bg-white/10 mx-1" />
        <button 
          onClick={handleDelete}
          disabled={selectedIds.length === 0}
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white/40 hover:text-red-500 hover:bg-red-500/10 disabled:opacity-20 transition-all"
        >
          <Trash2 className="w-5 h-5" />
        </button>
        <label className="w-12 h-12 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 cursor-pointer transition-all">
          <Camera className="w-5 h-5" />
          <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
        </label>
      </aside>

      {/* Floating Layers Panel */}
      <aside className="fixed top-24 left-8 w-64 bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-6 z-50 shadow-2xl">
        <h2 className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-6">Katmanlar</h2>
        <div className="space-y-2">
          {layers.map((layer, index) => (
            <div key={layer.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5">
              <div className="flex items-center gap-2">
                <button onClick={() => {
                  if (index > 0) {
                    const newLayers = [...layers];
                    [newLayers[index], newLayers[index - 1]] = [newLayers[index - 1], newLayers[index]];
                    setLayers(newLayers);
                  }
                }} className="text-white/20 hover:text-white">▲</button>
                <button onClick={() => {
                  if (index < layers.length - 1) {
                    const newLayers = [...layers];
                    [newLayers[index], newLayers[index + 1]] = [newLayers[index + 1], newLayers[index]];
                    setLayers(newLayers);
                  }
                }} className="text-white/20 hover:text-white">▼</button>
                <input 
                  value={layer.name}
                  onChange={(e) => setLayers(layers.map(l => l.id === layer.id ? { ...l, name: e.target.value } : l))}
                  className="bg-transparent text-xs text-white/60 focus:outline-none focus:text-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setLayers(layers.map(l => l.id === layer.id ? { ...l, visible: !l.visible } : l))}
                  className="text-white/40 hover:text-white"
                >
                  {layer.visible ? 'Görünür' : 'Gizli'}
                </button>
                {layer.id !== 'default' && (
                  <button onClick={() => deleteLayer(layer.id)} className="text-white/40 hover:text-red-500">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
          <button 
            onClick={() => setLayers([...layers, { id: `layer-${Date.now()}`, name: 'Yeni Katman', visible: true }])}
            className="w-full text-xs text-[#6366F1] hover:text-white mt-4"
          >
            + Katman Ekle
          </button>
        </div>
      </aside>

      {/* Floating Properties Panel */}
      {selectedIds.length > 0 && (
        <aside className="fixed top-24 right-8 w-64 bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-6 z-50 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
              {selectedIds.length > 1 ? `${selectedIds.length} Nesne Seçili` : 'Özellikler'}
            </h2>
            <button onClick={() => setSelectedIds([])} className="text-white/20 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-bold text-white/20 uppercase mb-2 tracking-wider">Renk</label>
              <div className="flex flex-wrap gap-2">
                {['#6366F1', '#00FF00', '#0000FF', '#FFFFFF', '#FFFF00', '#FF00FF', '#000000'].map(color => (
                  <button
                    key={color}
                    onClick={() => {
                      setObjects(objects.map(o => selectedIds.includes(o.id) ? { ...o, stroke: color } : o));
                    }}
                    className={cn(
                      "w-6 h-6 rounded-full border-2",
                      objects.find(o => o.id === selectedIds[0])?.stroke === color ? "border-white" : "border-transparent"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {selectedIds.length === 1 && (
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Düzenleme</label>
                <div className="grid grid-cols-4 gap-1">
                  <button onClick={() => handleMoveZ('front')} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg" title="En Öne Getir"><ArrowUp className="w-4 h-4" /></button>
                  <button onClick={() => handleMoveZ('back')} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg" title="En Arkaya Gönder"><ArrowDown className="w-4 h-4" /></button>
                  <button onClick={() => handleAlign('left')} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg" title="Sola Hizala">L</button>
                  <button onClick={() => handleAlign('right')} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg" title="Sağa Hizala">R</button>
                  <button onClick={() => handleAlign('center')} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg" title="Ortaya Hizala">C</button>
                  <button onClick={() => handleAlign('top')} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg" title="Üste Hizala">T</button>
                  <button onClick={() => handleAlign('bottom')} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg" title="Alta Hizala">B</button>
                  <button onClick={() => handleAlign('middle')} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg" title="Dikey Ortala">M</button>
                </div>
              </div>
            )}

            {selectedIds.length === 1 && (
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Katman</label>
                <select
                  value={objects.find(o => o.id === selectedIds[0])?.layer || 'default'}
                  onChange={(e) => setObjects(objects.map(o => o.id === selectedIds[0] ? { ...o, layer: e.target.value } : o))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs focus:outline-none focus:border-[#6366F1] text-white"
                >
                  {layers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            )}

            {selectedIds.length === 1 && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={toggleLock}
                  className={cn(
                    "flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-bold transition-all border",
                    objects.find(o => o.id === selectedIds[0])?.isLocked 
                      ? "bg-[#6366F1]/10 text-[#6366F1] border-[#6366F1]/20" 
                      : "bg-white/5 hover:bg-white/10 text-white border-white/10"
                  )}
                >
                  {objects.find(o => o.id === selectedIds[0])?.isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  {objects.find(o => o.id === selectedIds[0])?.isLocked ? 'Kilidi Aç' : 'Kilitle'}
                </button>
                <button
                  onClick={() => {
                    setObjects(objects.map(o => o.id === selectedIds[0] ? { ...o, visible: o.visible === false ? true : false } : o));
                  }}
                  className={cn(
                    "flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-bold transition-all border",
                    objects.find(o => o.id === selectedIds[0])?.visible === false
                      ? "bg-white/5 hover:bg-white/10 text-white border-white/10"
                      : "bg-[#6366F1]/10 text-[#6366F1] border-[#6366F1]/20"
                  )}
                >
                  {objects.find(o => o.id === selectedIds[0])?.visible === false ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {objects.find(o => o.id === selectedIds[0])?.visible === false ? 'Göster' : 'Gizle'}
                </button>
              </div>
            )}

            {selectedIds.length === 1 && ['sticky', 'text'].includes(objects.find(o => o.id === selectedIds[0])?.type || '') && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-white/20 uppercase mb-2 tracking-wider">Metin</label>
                  <textarea
                    value={objects.find(o => o.id === selectedIds[0])?.text || ''}
                    onChange={(e) => {
                      setObjects(objects.map(o => o.id === selectedIds[0] ? { ...o, text: e.target.value } : o));
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs focus:outline-none focus:border-[#6366F1] text-white"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-white/20 uppercase mb-2 tracking-wider">Font</label>
                  <select
                    value={objects.find(o => o.id === selectedIds[0])?.fontFamily || 'Inter'}
                    onChange={(e) => setObjects(objects.map(o => o.id === selectedIds[0] ? { ...o, fontFamily: e.target.value } : o))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs focus:outline-none focus:border-[#6366F1] text-white"
                  >
                    <option value="Inter">Inter</option>
                    <option value="Arial">Arial</option>
                    <option value="Times New Roman">Times New Roman</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-white/20 uppercase mb-2 tracking-wider">Hizalama</label>
                  <div className="flex gap-2">
                    <button onClick={() => setObjects(objects.map(o => o.id === selectedIds[0] ? { ...o, align: 'left' } : o))} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg">L</button>
                    <button onClick={() => setObjects(objects.map(o => o.id === selectedIds[0] ? { ...o, align: 'center' } : o))} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg">C</button>
                    <button onClick={() => setObjects(objects.map(o => o.id === selectedIds[0] ? { ...o, align: 'right' } : o))} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg">R</button>
                  </div>
                </div>
              </div>
            )}

            {selectedIds.length === 1 && objects.find(o => o.id === selectedIds[0])?.type === 'measure' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-white/20 uppercase mb-2 tracking-wider">Gerçek Ölçü</label>
                  <input
                    type="number"
                    value={objects.find(o => o.id === selectedIds[0])?.realMeasurement || ''}
                    onChange={(e) => {
                      setObjects(objects.map(o => o.id === selectedIds[0] ? { ...o, realMeasurement: e.target.value } : o));
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs focus:outline-none focus:border-[#6366F1] text-white"
                  />
                </div>
                <button
                  onClick={handleSetReference}
                  className="w-full bg-[#6366F1] text-black text-xs font-bold px-4 py-2 rounded-xl hover:scale-105 transition-transform"
                >
                  Referans Olarak Ayarla
                </button>
              </div>
            )}

            {selectedIds.length === 1 && ['line', 'arrow', 'measure', 'pen'].includes(objects.find(o => o.id === selectedIds[0])?.type || '') && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-white/20 uppercase mb-2 tracking-wider">Çizgi Ucu</label>
                  <select
                    value={objects.find(o => o.id === selectedIds[0])?.lineCap || 'round'}
                    onChange={(e) => {
                      const val = e.target.value as 'butt' | 'round' | 'square';
                      setObjects(objects.map(o => o.id === selectedIds[0] ? { ...o, lineCap: val } : o));
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#6366F1] text-white"
                  >
                    <option value="butt">Butt</option>
                    <option value="round">Round</option>
                    <option value="square">Square</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-white/20 uppercase mb-2 tracking-wider">Çizgi Birleşimi</label>
                  <select
                    value={objects.find(o => o.id === selectedIds[0])?.lineJoin || 'round'}
                    onChange={(e) => {
                      const val = e.target.value as 'miter' | 'round' | 'bevel';
                      setObjects(objects.map(o => o.id === selectedIds[0] ? { ...o, lineJoin: val } : o));
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#6366F1] text-white"
                  >
                    <option value="miter">Miter</option>
                    <option value="round">Round</option>
                    <option value="bevel">Bevel</option>
                  </select>
                </div>
              </div>
            )}

            {selectedIds.length === 1 && objects.find(o => o.id === selectedIds[0])?.type === 'sticky' && (
              <div>
                <label className="block text-[10px] font-bold text-white/20 uppercase mb-2 tracking-wider">Arkaplan</label>
                <div className="flex flex-wrap gap-2">
                  {['#FFFF88', '#FFCCFF', '#CCFFFF', '#CCFFCC', '#FFCCCC'].map(color => (
                    <button
                      key={color}
                      onClick={() => {
                        setObjects(objects.map(o => o.id === selectedIds[0] ? { ...o, fill: color } : o));
                      }}
                      className={cn(
                        "w-6 h-6 rounded-lg border-2",
                        objects.find(o => o.id === selectedIds[0])?.fill === color ? "border-white" : "border-transparent"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            )}

            {selectedIds.length === 1 && (
              <div>
                <label className="block text-[10px] font-bold text-white/20 uppercase mb-2 tracking-wider">Ölçü</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Değer"
                    value={objects.find(o => o.id === selectedIds[0])?.realMeasurement || ''}
                    onChange={(e) => {
                      const newVal = e.target.value;
                      setObjects(objects.map(o => {
                        if (o.id === selectedIds[0]) {
                          const newObj = { ...o, realMeasurement: newVal };
                          if (newObj.isReference && parseFloat(newVal) > 0) {
                            const dx = (newObj.points?.[2] || 0);
                            const dy = (newObj.points?.[3] || 0);
                            const pixelDist = Math.sqrt(dx * dx + dy * dy);
                            const pixelsPerUnit = pixelDist / parseFloat(newVal);
                            updateDoc(doc(db, 'projects', projectId!, 'surveys', surveyId!), {
                              pixelsPerUnit
                            });
                          }
                          return newObj;
                        }
                        return o;
                      }));
                    }}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#6366F1] text-white"
                  />
                  <select 
                    className="bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-[10px] text-white"
                    value={objects.find(o => o.id === selectedIds[0])?.unit || 'cm'}
                    onChange={(e) => {
                      const newUnit = e.target.value;
                      setObjects(objects.map(o => {
                        if (o.id === selectedIds[0]) {
                          const newObj = { ...o, unit: newUnit };
                          if (newObj.isReference) {
                            updateDoc(doc(db, 'projects', projectId!, 'surveys', surveyId!), {
                              referenceUnit: newUnit
                            });
                          }
                          return newObj;
                        }
                        return o;
                      }));
                    }}
                  >
                    <option value="cm">cm</option>
                    <option value="mm">mm</option>
                    <option value="m">m</option>
                  </select>
                </div>
              </div>
            )}

            {selectedIds.length === 1 && objects.find(o => o.id === selectedIds[0])?.type === 'measure' && (
              <div className="pt-4 border-t border-white/10 space-y-3">
                <p className="text-[10px] text-white/40 leading-relaxed">
                  Bu ölçüyü tüm çalışma için referans ölçek olarak ayarlayabilirsiniz.
                </p>
                {!objects.find(o => o.id === selectedIds[0])?.isReference ? (
                  <button
                    onClick={handleSetReference}
                    className="w-full bg-[#6366F1]/10 hover:bg-[#6366F1]/20 text-[#6366F1] text-[10px] font-bold py-3 rounded-xl transition-all border border-[#6366F1]/20"
                  >
                    Referans Ölçek Olarak Ayarla
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      try {
                        await updateDoc(doc(db, 'projects', projectId!, 'surveys', surveyId!), {
                          pixelsPerUnit: null,
                          referenceUnit: null
                        });
                        setObjects(objects.map(o => ({ ...o, isReference: false })));
                      } catch (error) {
                        handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}/surveys/${surveyId}`);
                      }
                    }}
                    className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] font-bold py-3 rounded-xl transition-all border border-red-500/20"
                  >
                    Referansı Kaldır
                  </button>
                )}
              </div>
            )}

            <div className="pt-4 border-t border-white/10 grid grid-cols-2 gap-2">
              <button
                onClick={() => handleMoveZ('up')}
                className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 py-3 rounded-xl text-[10px] font-bold transition-all"
                title="Öne Getir"
              >
                <ArrowUp className="w-3 h-3" /> Üst
              </button>
              <button
                onClick={() => handleMoveZ('down')}
                className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 py-3 rounded-xl text-[10px] font-bold transition-all"
                title="Arkaya Gönder"
              >
                <ArrowDown className="w-3 h-3" /> Alt
              </button>
              <button
                onClick={toggleLock}
                className={cn(
                  "col-span-2 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-bold transition-all border",
                  objects.find(o => o.id === selectedIds[0])?.isLocked
                    ? "bg-red-500/10 border-red-500/20 text-red-500"
                    : "bg-white/5 border-white/10 text-white/60 hover:text-white"
                )}
              >
                {objects.find(o => o.id === selectedIds[0])?.isLocked ? (
                  <><Lock className="w-3 h-3" /> Kilidi Aç</>
                ) : (
                  <><Unlock className="w-3 h-3" /> Kilitle</>
                )}
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Zoom Controls */}
      <div className="fixed bottom-8 right-8 flex items-center gap-2 bg-white/[0.03] backdrop-blur-2xl border border-white/10 p-2 rounded-2xl shadow-2xl z-50">
        <button 
          onClick={() => setSnapToGrid(!snapToGrid)} 
          className={cn("p-2 rounded-xl transition-colors", snapToGrid ? "text-[#6366F1] bg-[#6366F1]/10" : "text-white/40 hover:bg-white/5")}
          title="Mıknatıs (Izgaraya Yapış)"
        >
          <Magnet className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-white/10 mx-1" />
        <button 
          onClick={() => setShowGrid(!showGrid)} 
          className={cn("p-2 rounded-xl transition-colors", showGrid ? "text-[#6366F1] bg-[#6366F1]/10" : "text-white/40 hover:bg-white/5")}
          title="Izgarayı Göster/Gizle"
        >
          <Layers className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-white/10 mx-1" />
        <button onClick={() => setScale(s => Math.max(0.1, s - 0.1))} className="p-2 hover:bg-white/5 rounded-xl text-white/60"><ZoomOut className="w-4 h-4" /></button>
        <span className="text-[10px] font-bold w-10 text-center text-white/40">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(s => Math.min(5, s + 0.1))} className="p-2 hover:bg-white/5 rounded-xl text-white/60"><ZoomIn className="w-4 h-4" /></button>
        <div className="w-px h-4 bg-white/10 mx-1" />
        <button onClick={() => { setScale(1); setStagePos({ x: 0, y: 0 }); }} className="p-2 hover:bg-white/5 rounded-xl text-white/60"><Maximize2 className="w-4 h-4" /></button>
      </div>

      {/* Canvas Area */}
      <div className="w-full h-full cursor-crosshair">
        <Stage
          width={stageSize.width}
          height={stageSize.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          ref={stageRef}
          scaleX={scale}
          scaleY={scale}
          x={stagePos.x}
          y={stagePos.y}
          draggable={tool === 'select'}
          onDragEnd={(e) => setStagePos({ x: e.target.x(), y: e.target.y() })}
        >
          <Layer>
            {/* Grid background */}
            {showGrid && gridDots}
            
            {bgImage && (
              <KonvaImage 
                image={bgImage} 
                width={bgImage.width} 
                height={bgImage.height} 
                listening={false}
                opacity={0.8}
              />
            )}
            {objects.map((obj) => {
              const commonProps = {
                id: obj.id,
                x: obj.x,
                y: obj.y,
                rotation: obj.rotation || 0,
                scaleX: obj.scaleX || 1,
                scaleY: obj.scaleY || 1,
                stroke: obj.stroke,
                strokeWidth: obj.strokeWidth / scale,
                draggable: tool === 'select' && !obj.isLocked,
                visible: (layers.find(l => l.id === (obj.layer || 'default'))?.visible !== false) && (obj.visible !== false),
                onClick: (e: any) => {
                  if (tool !== 'select') return;
                  const id = obj.id;
                  const isShift = e.evt.shiftKey;
                  let newSelectedIds = [...selectedIds];

                  if (isShift) {
                    if (newSelectedIds.includes(id)) {
                      newSelectedIds = newSelectedIds.filter(sid => sid !== id);
                    } else {
                      newSelectedIds.push(id);
                    }
                  } else {
                    newSelectedIds = [id];
                  }

                  // Group selection logic
                  const groupIds = objects
                    .filter(o => newSelectedIds.includes(o.id) && o.groupId)
                    .map(o => o.groupId);
                  
                  if (groupIds.length > 0) {
                    const allInGroups = objects
                      .filter(o => o.groupId && groupIds.includes(o.groupId))
                      .map(o => o.id);
                    newSelectedIds = Array.from(new Set([...newSelectedIds, ...allInGroups]));
                  }

                  setSelectedIds(newSelectedIds);
                },
                onTap: (e: any) => {
                  if (tool !== 'select') return;
                  setSelectedIds([obj.id]);
                },
                onDragEnd: (e: any) => {
                  const dx = e.target.x() - obj.x;
                  const dy = e.target.y() - obj.y;
                  
                  const updated = objects.map(o => {
                    if (selectedIds.includes(o.id)) {
                      return { ...o, x: o.x + dx, y: o.y + dy };
                    }
                    return o;
                  });
                  setObjects(updated);
                }
              };

              if (obj.type === 'rect') return <Rect key={obj.id} {...commonProps} width={obj.width} height={obj.height} visible={obj.visible !== false} />;
              if (obj.type === 'ellipse') return <Ellipse key={obj.id} {...commonProps} radiusX={Math.abs((obj.width || 0) / 2)} radiusY={Math.abs((obj.height || 0) / 2)} visible={obj.visible !== false} />;
              if (obj.type === 'polygon') return <Line key={obj.id} {...commonProps} points={obj.points} closed={true} stroke={obj.stroke} strokeWidth={obj.strokeWidth} visible={obj.visible !== false} />;
              if (obj.type === 'star') return <Star key={obj.id} {...commonProps} numPoints={5} innerRadius={20/scale} outerRadius={40/scale} stroke={obj.stroke} strokeWidth={obj.strokeWidth} visible={obj.visible !== false} />;
              if (obj.type === 'line' || obj.type === 'pen') return <Line key={obj.id} {...commonProps} points={obj.points} tension={obj.type === 'pen' ? 0.5 : 0} lineCap={obj.lineCap || 'round'} lineJoin={obj.lineJoin || 'round'} visible={obj.visible !== false} />;
              if (obj.type === 'arrow') return <Arrow key={obj.id} {...commonProps} points={obj.points} pointerLength={10 / scale} pointerWidth={10 / scale} lineCap={obj.lineCap || 'round'} lineJoin={obj.lineJoin || 'round'} visible={obj.visible !== false} />;
              if (obj.type === 'measure') {
                const points = obj.points || [0, 0, 0, 0];
                const x2 = points[2];
                const y2 = points[3];
                const midX = x2 / 2;
                const midY = y2 / 2;
                const angle = Math.atan2(y2, x2) * (180 / Math.PI);
                const isRef = obj.isReference;
                const strokeColor = isRef ? '#00FF00' : obj.stroke;
                
                return (
                  <Group key={obj.id} {...commonProps} visible={obj.visible !== false}>
                    <Line 
                      points={points} 
                      stroke={strokeColor} 
                      strokeWidth={2 / scale} 
                    />
                    {/* Perpendicular markers */}
                    <Line 
                      points={[0, -10 / scale, 0, 10 / scale]} 
                      stroke={strokeColor} 
                      strokeWidth={2 / scale} 
                      rotation={angle + 90}
                    />
                    <Line 
                      points={[0, -10 / scale, 0, 10 / scale]} 
                      stroke={strokeColor} 
                      strokeWidth={2 / scale} 
                      rotation={angle + 90}
                      x={x2}
                      y={y2}
                    />
                    <Group x={midX} y={midY} rotation={angle}>
                      <Rect 
                        fill={isRef ? '#00FF00' : "#1a1a1a"} 
                        width={isRef ? 80 / scale : 60 / scale} 
                        height={20 / scale} 
                        x={isRef ? -40 / scale : -30 / scale} 
                        y={-10 / scale} 
                        cornerRadius={4 / scale}
                      />
                      <Text 
                        text={`${isRef ? 'REF: ' : ''}${obj.realMeasurement} ${obj.unit || 'cm'}`} 
                        fontSize={12 / scale} 
                        fill={isRef ? '#000000' : "#ffffff"} 
                        align="center" 
                        verticalAlign="middle" 
                        width={isRef ? 80 / scale : 60 / scale}
                        height={20 / scale}
                        x={isRef ? -40 / scale : -30 / scale}
                        y={-10 / scale}
                        fontStyle="bold"
                      />
                    </Group>
                  </Group>
                );
              }
              if (obj.type === 'text') return <Text key={obj.id} {...commonProps} text={obj.text} fontSize={(obj.fontSize || 20) / scale} fill={obj.stroke} visible={obj.visible !== false} />;
              if (obj.type === 'sticky') {
                return (
                  <Group 
                    key={obj.id} 
                    id={obj.id}
                    x={obj.x} 
                    y={obj.y} 
                    rotation={obj.rotation || 0}
                    scaleX={obj.scaleX || 1}
                    scaleY={obj.scaleY || 1}
                    draggable={tool === 'select'} 
                    visible={obj.visible !== false}
                    onClick={(e: any) => {
                      if (tool !== 'select') return;
                      const id = obj.id;
                      const isShift = e.evt.shiftKey;
                      let newSelectedIds = [...selectedIds];

                      if (isShift) {
                        if (newSelectedIds.includes(id)) {
                          newSelectedIds = newSelectedIds.filter(sid => sid !== id);
                        } else {
                          newSelectedIds.push(id);
                        }
                      } else {
                        newSelectedIds = [id];
                      }

                      const groupIds = objects
                        .filter(o => newSelectedIds.includes(o.id) && o.groupId)
                        .map(o => o.groupId);
                      
                      if (groupIds.length > 0) {
                        const allInGroups = objects
                          .filter(o => o.groupId && groupIds.includes(o.groupId))
                          .map(o => o.id);
                        newSelectedIds = Array.from(new Set([...newSelectedIds, ...allInGroups]));
                      }

                      setSelectedIds(newSelectedIds);
                    }} 
                    onTap={() => setSelectedIds([obj.id])}
                    onDragEnd={(e) => {
                      const dx = e.target.x() - obj.x;
                      const dy = e.target.y() - obj.y;
                      
                      const updated = objects.map(o => {
                        if (selectedIds.includes(o.id)) {
                          return { ...o, x: o.x + dx, y: o.y + dy };
                        }
                        return o;
                      });
                      setObjects(updated);
                    }}
                  >
                    <Rect 
                      width={obj.width} 
                      height={obj.height} 
                      fill={obj.fill} 
                      stroke={obj.stroke} 
                      strokeWidth={1/scale} 
                      cornerRadius={4/scale}
                      shadowBlur={10/scale} 
                      shadowOpacity={0.1} 
                    />
                    <Text 
                      text={obj.text} 
                      width={obj.width} 
                      height={obj.height} 
                      padding={15/scale} 
                      fontSize={14/scale} 
                      fill="#000000" 
                      align="center" 
                      verticalAlign="middle" 
                      fontStyle="bold"
                    />
                  </Group>
                );
              }
              return null;
            })}
            {selectedIds.length > 0 && (
              <Transformer
                ref={transformerRef}
                rotateEnabled={true}
                borderEnabled={true}
                borderDash={[6, 2]}
                enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top-center', 'bottom-center', 'left-center', 'right-center']}
                onTransformEnd={handleTransformEnd}
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < 5 || newBox.height < 5) return oldBox;
                  return newBox;
                }}
              />
            )}
          </Layer>
        </Stage>
      </div>

      {/* Magnifier / Loupe */}
      {isDrawing && tool !== 'select' && bgImage && (
        <div 
          className="fixed pointer-events-none border-2 border-[#6366F1] rounded-full overflow-hidden shadow-2xl z-[100] bg-black"
          style={{
            left: mousePos.x + 40,
            top: mousePos.y - 180,
            width: 160,
            height: 160,
          }}
        >
          <div 
            style={{
              position: 'absolute',
              left: -((mousePos.x - stagePos.x) / scale) * scale * 2 + 80,
              top: -((mousePos.y - stagePos.y) / scale) * scale * 2 + 80,
              transform: `scale(2)`,
              transformOrigin: '0 0'
            }}
          >
            <img 
              src={bgImage.src} 
              alt="" 
              style={{ 
                width: bgImage.width * scale, 
                height: bgImage.height * scale,
                maxWidth: 'none'
              }} 
            />
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-full h-[1px] bg-[#6366F1]/50" />
            <div className="absolute w-[1px] h-full bg-[#6366F1]/50" />
          </div>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[8px] font-bold text-white uppercase tracking-widest">
            2x Zoom
          </div>
        </div>
      )}
    </div>
  );
}


function Loader2({ className }: { className?: string }) {
  return <div className={cn("animate-spin rounded-full border-2 border-current border-t-transparent", className)} />;
}
