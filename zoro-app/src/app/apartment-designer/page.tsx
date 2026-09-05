'use client';

import React, { useState, useRef, useEffect } from 'react';

interface Measurement {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  label: string;
  distance: number;
}

interface Annotation {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
}

interface Wall {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  type: 'new' | 'remove';
  color: string;
}

interface Room {
  id: string;
  name: string;
  points: { x: number; y: number }[];
  color: string;
}

type Tool = 'measure' | 'annotate' | 'pan' | 'wall' | 'remove-wall' | 'area';

export default function ApartmentDesigner() {
  const [floorPlanImage, setFloorPlanImage] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [walls, setWalls] = useState<Wall[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentTool, setCurrentTool] = useState<Tool>('measure');
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const [scale, setScale] = useState(1);
  const [scaleCalibration, setScaleCalibration] = useState<number>(100);
  const [scaleUnit, setScaleUnit] = useState<'ft' | 'm' | 'cm'>('ft');
  const [selectedMeasurement, setSelectedMeasurement] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageOpacity, setImageOpacity] = useState(1);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFloorPlanImage(event.target?.result as string);
        setMeasurements([]);
        setAnnotations([]);
        setImageOffset({ x: 0, y: 0 });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFloorPlanImage(event.target?.result as string);
        setMeasurements([]);
        setAnnotations([]);
        setImageOffset({ x: 0, y: 0 });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - imageOffset.x) / scale,
      y: (e.clientY - rect.top - imageOffset.y) / scale
    };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoordinates(e);
    
    if (currentTool === 'pan') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - imageOffset.x, y: e.clientY - imageOffset.y });
      return;
    }

    if (currentTool === 'measure') {
      setIsDrawing(true);
      setStartPoint(coords);
    } else if (currentTool === 'annotate') {
      const text = prompt('Enter annotation:');
      if (text) {
        const newAnnotation: Annotation = {
          id: Date.now().toString(),
          x: coords.x,
          y: coords.y,
          text,
          color: '#FF0000'
        };
        setAnnotations([...annotations, newAnnotation]);
      }
    } else if (currentTool === 'wall' || currentTool === 'remove-wall') {
      setIsDrawing(true);
      setStartPoint(coords);
    } else if (currentTool === 'area') {
      setCurrentPoints([...currentPoints, coords]);
      if (e.shiftKey && currentPoints.length >= 2) {
        const roomName = prompt('Enter room name (e.g., Study, Living Room):') || 'Room';
        const area = calculateArea([...currentPoints, coords]);
        const newRoom: Room = {
          id: Date.now().toString(),
          name: `${roomName} (${area.toFixed(1)} ${scaleUnit}²)`,
          points: [...currentPoints, coords],
          color: `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 0.3)`
        };
        setRooms([...rooms, newRoom]);
        setCurrentPoints([]);
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (currentTool === 'pan' && isDragging) {
      setImageOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (currentTool === 'pan') {
      setIsDragging(false);
      return;
    }

    if (isDrawing && startPoint && currentTool === 'measure') {
      const endCoords = getCanvasCoordinates(e);
      const pixelDistance = Math.sqrt(
        Math.pow(endCoords.x - startPoint.x, 2) + 
        Math.pow(endCoords.y - startPoint.y, 2)
      );
      
      const realDistance = (pixelDistance * scaleCalibration) / 100;
      
      const newMeasurement: Measurement = {
        id: Date.now().toString(),
        startX: startPoint.x,
        startY: startPoint.y,
        endX: endCoords.x,
        endY: endCoords.y,
        label: `${realDistance.toFixed(2)} ${scaleUnit}`,
        distance: realDistance
      };
      
      setMeasurements([...measurements, newMeasurement]);
      setIsDrawing(false);
      setStartPoint(null);
    } else if (isDrawing && startPoint && (currentTool === 'wall' || currentTool === 'remove-wall')) {
      const endCoords = getCanvasCoordinates(e);
      const newWall: Wall = {
        id: Date.now().toString(),
        startX: startPoint.x,
        startY: startPoint.y,
        endX: endCoords.x,
        endY: endCoords.y,
        type: currentTool === 'wall' ? 'new' : 'remove',
        color: currentTool === 'wall' ? '#00FF00' : '#FF0000'
      };
      setWalls([...walls, newWall]);
      setIsDrawing(false);
      setStartPoint(null);
    }
  };

  const deleteMeasurement = (id: string) => {
    setMeasurements(measurements.filter(m => m.id !== id));
    setSelectedMeasurement(null);
  };

  const deleteAnnotation = (id: string) => {
    setAnnotations(annotations.filter(a => a.id !== id));
  };

  const deleteWall = (id: string) => {
    setWalls(walls.filter(w => w.id !== id));
  };

  const calculateArea = (points: { x: number; y: number }[]) => {
    if (points.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    area = Math.abs(area) / 2;
    const pixelsPerUnit = 100 / scaleCalibration;
    const realArea = area / (pixelsPerUnit * pixelsPerUnit);
    return realArea;
  };

  const exportData = () => {
    const data = {
      floorPlanImage,
      measurements,
      annotations,
      walls,
      rooms,
      scale: scaleCalibration,
      unit: scaleUnit
    };
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'apartment-redesign.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = 'annotated-floor-plan.png';
    link.click();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !floorPlanImage) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(imageOffset.x, imageOffset.y);
      ctx.scale(scale, scale);
      ctx.globalAlpha = imageOpacity;
      ctx.drawImage(img, 0, 0);
      ctx.globalAlpha = 1;
      
      measurements.forEach(m => {
        ctx.beginPath();
        ctx.moveTo(m.startX, m.startY);
        ctx.lineTo(m.endX, m.endY);
        ctx.strokeStyle = selectedMeasurement === m.id ? '#0066FF' : '#FF0000';
        ctx.lineWidth = 3 / scale;
        ctx.stroke();
        
        const midX = (m.startX + m.endX) / 2;
        const midY = (m.startY + m.endY) / 2;
        
        ctx.fillStyle = 'white';
        ctx.fillRect(midX - 40 / scale, midY - 12 / scale, 80 / scale, 24 / scale);
        ctx.fillStyle = '#FF0000';
        ctx.font = `${16 / scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(m.label, midX, midY + 5 / scale);
        
        ctx.beginPath();
        ctx.arc(m.startX, m.startY, 5 / scale, 0, 2 * Math.PI);
        ctx.fillStyle = '#FF0000';
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(m.endX, m.endY, 5 / scale, 0, 2 * Math.PI);
        ctx.fill();
      });
      
      annotations.forEach(a => {
        ctx.fillStyle = a.color;
        ctx.font = `${18 / scale}px Arial`;
        ctx.fillText(a.text, a.x, a.y);
        
        ctx.beginPath();
        ctx.arc(a.x, a.y, 8 / scale, 0, 2 * Math.PI);
        ctx.strokeStyle = a.color;
        ctx.lineWidth = 2 / scale;
        ctx.stroke();
      });
      
      walls.forEach(w => {
        ctx.beginPath();
        ctx.moveTo(w.startX, w.startY);
        ctx.lineTo(w.endX, w.endY);
        ctx.strokeStyle = w.color;
        ctx.lineWidth = 5 / scale;
        ctx.stroke();
        
        if (w.type === 'new') {
          ctx.fillStyle = w.color;
          ctx.font = `${14 / scale}px Arial`;
          const midX = (w.startX + w.endX) / 2;
          const midY = (w.startY + w.endY) / 2;
          ctx.fillText('NEW WALL', midX, midY - 10 / scale);
        } else {
          ctx.setLineDash([10 / scale, 10 / scale]);
          ctx.beginPath();
          ctx.moveTo(w.startX, w.startY);
          ctx.lineTo(w.endX, w.endY);
          ctx.strokeStyle = w.color;
          ctx.lineWidth = 3 / scale;
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });
      
      rooms.forEach(r => {
        if (r.points.length >= 3) {
          ctx.beginPath();
          ctx.moveTo(r.points[0].x, r.points[0].y);
          for (let i = 1; i < r.points.length; i++) {
            ctx.lineTo(r.points[i].x, r.points[i].y);
          }
          ctx.closePath();
          ctx.fillStyle = r.color;
          ctx.fill();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2 / scale;
          ctx.stroke();
          
          const centerX = r.points.reduce((sum, p) => sum + p.x, 0) / r.points.length;
          const centerY = r.points.reduce((sum, p) => sum + p.y, 0) / r.points.length;
          ctx.fillStyle = '#000000';
          ctx.font = `bold ${16 / scale}px Arial`;
          ctx.textAlign = 'center';
          ctx.fillText(r.name, centerX, centerY);
        }
      });
      
      if (currentPoints.length > 0) {
        ctx.fillStyle = 'rgba(255, 165, 0, 0.5)';
        currentPoints.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5 / scale, 0, 2 * Math.PI);
          ctx.fill();
        });
      }
      
      ctx.restore();
    };
    img.src = floorPlanImage;
  }, [floorPlanImage, measurements, annotations, walls, rooms, currentPoints, scale, selectedMeasurement, imageOffset, imageOpacity]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Apartment Designer</h1>
          <p className="text-gray-600">Upload a floor plan and measure distances</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Upload Floor Plan</h2>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded transition-colors mb-2"
              >
                Choose Image
              </button>
              <p className="text-xs text-gray-500 text-center">or drag & drop on canvas</p>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Tools</h2>
              <div className="space-y-2">
                <button
                  onClick={() => setCurrentTool('measure')}
                  className={`w-full py-2 px-4 rounded transition-colors text-sm ${
                    currentTool === 'measure' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  📏 Measure Distance
                </button>
                <button
                  onClick={() => setCurrentTool('wall')}
                  className={`w-full py-2 px-4 rounded transition-colors text-sm ${
                    currentTool === 'wall' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  🧱 Draw New Wall
                </button>
                <button
                  onClick={() => setCurrentTool('remove-wall')}
                  className={`w-full py-2 px-4 rounded transition-colors text-sm ${
                    currentTool === 'remove-wall' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  🔨 Mark Wall to Remove
                </button>
                <button
                  onClick={() => setCurrentTool('area')}
                  className={`w-full py-2 px-4 rounded transition-colors text-sm ${
                    currentTool === 'area' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  📐 Define Room Area
                </button>
                <button
                  onClick={() => setCurrentTool('annotate')}
                  className={`w-full py-2 px-4 rounded transition-colors text-sm ${
                    currentTool === 'annotate' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  📝 Add Label
                </button>
                <button
                  onClick={() => setCurrentTool('pan')}
                  className={`w-full py-2 px-4 rounded transition-colors text-sm ${
                    currentTool === 'pan' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  🖐️ Pan/Move
                </button>
              </div>
              {currentTool === 'area' && (
                <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                  <p className="font-semibold">Area Tool:</p>
                  <p>Click points to define room shape. Hold SHIFT and click to finish.</p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Scale & View</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    100 pixels = 
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={scaleCalibration}
                      onChange={(e) => setScaleCalibration(parseFloat(e.target.value))}
                      className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
                    />
                    <select
                      value={scaleUnit}
                      onChange={(e) => setScaleUnit(e.target.value as 'ft' | 'm' | 'cm')}
                      className="border border-gray-300 rounded px-2 py-2 text-sm"
                    >
                      <option value="ft">ft</option>
                      <option value="m">m</option>
                      <option value="cm">cm</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Zoom: {(scale * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.1"
                    value={scale}
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Floor Plan Opacity: {(imageOpacity * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    min="0.2"
                    max="1"
                    step="0.1"
                    value={imageOpacity}
                    onChange={(e) => setImageOpacity(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Measurements</h2>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {measurements.map(m => (
                  <div
                    key={m.id}
                    className={`p-2 rounded flex justify-between items-center ${
                      selectedMeasurement === m.id ? 'bg-blue-100 border border-blue-500' : 'bg-gray-50'
                    }`}
                    onClick={() => setSelectedMeasurement(m.id)}
                  >
                    <span className="text-sm">{m.label}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteMeasurement(m.id); }}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Rooms</h2>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {rooms.map(r => (
                  <div
                    key={r.id}
                    className="p-2 rounded flex justify-between items-center bg-gray-50"
                  >
                    <span className="text-sm">{r.name}</span>
                    <button
                      onClick={() => setRooms(rooms.filter(rm => rm.id !== r.id))}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Wall Changes</h2>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {walls.map(w => (
                  <div
                    key={w.id}
                    className="p-2 rounded flex justify-between items-center bg-gray-50"
                  >
                    <span className="text-sm">
                      {w.type === 'new' ? '🟢 New Wall' : '🔴 Remove Wall'}
                    </span>
                    <button
                      onClick={() => deleteWall(w.id)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Export</h2>
              <div className="space-y-2">
                <button
                  onClick={exportData}
                  disabled={!floorPlanImage}
                  className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded transition-colors disabled:bg-gray-300"
                >
                  Export Data (JSON)
                </button>
                <button
                  onClick={exportImage}
                  disabled={!floorPlanImage}
                  className="w-full bg-purple-500 hover:bg-purple-600 text-white py-2 px-4 rounded transition-colors disabled:bg-gray-300"
                >
                  Export Image (PNG)
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Canvas</h2>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-gray-300 rounded-lg overflow-auto"
                style={{ height: '700px' }}
              >
                {!floorPlanImage ? (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <p className="text-xl mb-2">Drop floor plan image here</p>
                      <p className="text-sm">or click "Choose Image" to upload</p>
                    </div>
                  </div>
                ) : (
                  <canvas
                    ref={canvasRef}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    className="cursor-crosshair"
                  />
                )}
              </div>
              <div className="mt-4 text-sm text-gray-600">
                <p><strong>Combining Two Apartments Instructions:</strong></p>
                <ul className="list-disc list-inside space-y-1 mt-2 text-xs">
                  <li>Upload floor plan showing both 2-bed units</li>
                  <li>Set scale (e.g., 100px = 10 feet)</li>
                  <li><strong>Red tool:</strong> Mark walls to remove (combine spaces)</li>
                  <li><strong>Green tool:</strong> Draw new walls (create study)</li>
                  <li><strong>Area tool:</strong> Click corners, SHIFT+click to finish and label rooms</li>
                  <li><strong>Measure:</strong> Check dimensions for furniture fit</li>
                  <li>Reduce opacity to see your changes clearly</li>
                  <li>Export your redesign plan</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
