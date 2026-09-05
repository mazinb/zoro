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

type Tool = 'measure' | 'annotate' | 'pan';

export default function ApartmentDesigner() {
  const [floorPlanImage, setFloorPlanImage] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [currentTool, setCurrentTool] = useState<Tool>('measure');
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [scaleCalibration, setScaleCalibration] = useState<number>(100);
  const [scaleUnit, setScaleUnit] = useState<'ft' | 'm' | 'cm'>('ft');
  const [selectedMeasurement, setSelectedMeasurement] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
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
    }
  };

  const deleteMeasurement = (id: string) => {
    setMeasurements(measurements.filter(m => m.id !== id));
    setSelectedMeasurement(null);
  };

  const deleteAnnotation = (id: string) => {
    setAnnotations(annotations.filter(a => a.id !== id));
  };

  const exportData = () => {
    const data = {
      floorPlanImage,
      measurements,
      annotations,
      scale: scaleCalibration,
      unit: scaleUnit
    };
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'floor-plan-measurements.json';
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
      ctx.drawImage(img, 0, 0);
      
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
      
      ctx.restore();
    };
    img.src = floorPlanImage;
  }, [floorPlanImage, measurements, annotations, scale, selectedMeasurement, imageOffset]);

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
                  className={`w-full py-2 px-4 rounded transition-colors ${
                    currentTool === 'measure' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  📏 Measure Distance
                </button>
                <button
                  onClick={() => setCurrentTool('annotate')}
                  className={`w-full py-2 px-4 rounded transition-colors ${
                    currentTool === 'annotate' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  📝 Add Annotation
                </button>
                <button
                  onClick={() => setCurrentTool('pan')}
                  className={`w-full py-2 px-4 rounded transition-colors ${
                    currentTool === 'pan' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  🖐️ Pan/Move
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Scale Calibration</h2>
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
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Measurements</h2>
              <div className="space-y-2 max-h-48 overflow-y-auto">
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
                      Delete
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
                <p><strong>Instructions:</strong></p>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li>Upload or drag a floor plan image onto the canvas</li>
                  <li>Set scale calibration (e.g., 100 pixels = 10 feet)</li>
                  <li>Use Measure tool: click start point, click end point to draw measurement</li>
                  <li>Use Annotate tool: click to add text notes</li>
                  <li>Use Pan tool: drag to move the image around</li>
                  <li>Adjust zoom slider to see details</li>
                  <li>Export your measurements as JSON or annotated image as PNG</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
